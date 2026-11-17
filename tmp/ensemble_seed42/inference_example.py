"""Offline inference for freshly trained FL03 or IH03 on the merged emotion classification task."""
import argparse,json,os
from pathlib import Path
os.environ.setdefault('HF_HUB_OFFLINE','1');os.environ.setdefault('TOKENIZERS_PARALLELISM','false')
import torch
from torch import nn
from transformers import AutoModel,AutoConfig,AutoTokenizer

class EmotionModel(nn.Module):
 def __init__(self,folder,config,mapping):
  super().__init__();self.encoder=AutoModel.from_config(AutoConfig.from_pretrained(folder/'best_checkpoint/encoder_config',local_files_only=True));self.dropout=nn.Dropout(config.get('head_dropout',.1));self.structure=config['structure'];hidden=self.encoder.config.hidden_size
  self.register_buffer('parent',torch.tensor(mapping['fine_parent']))
  if self.structure=='IH':self.coarse=nn.Linear(hidden,3);self.child_heads=nn.ModuleList([nn.Linear(hidden,3),nn.Linear(hidden,3),nn.Linear(hidden,len(mapping['fine_labels'])-6)])
  else:self.fine=nn.Linear(hidden,len(mapping['fine_labels']))
 def forward(self,features):
  h=self.encoder(**features).last_hidden_state[:,0]
  if self.structure=='IH':return self.coarse(self.dropout(h)),torch.cat([head(self.dropout(h)) for head in self.child_heads],dim=1)
  return None,self.fine(self.dropout(h))

class EmotionPredictor:
 def __init__(self,folder=None,device='auto',precision='bf16'):
  self.folder=Path(folder) if folder is not None else Path(__file__).resolve().parent
  self.config=json.loads((self.folder/'config.json').read_text(encoding='utf-8'));self.mapping=json.loads((self.folder/'label_mapping.json').read_text(encoding='utf-8'));self.labels=self.mapping['fine_labels'];self.structure=self.config['structure']
  if device=='auto':device='cuda' if torch.cuda.is_available() else 'cpu'
  self.device=torch.device(device);self.precision=precision if device=='cuda' else 'fp32';self.tokenizer=AutoTokenizer.from_pretrained(self.folder/'best_checkpoint',local_files_only=True)
  self.model=EmotionModel(self.folder,self.config,self.mapping)
  self.model.load_state_dict(torch.load(self.folder/'best_checkpoint/model.pt',map_location='cpu',weights_only=True),strict=True);self.model.to(self.device).eval().requires_grad_(False)
 @torch.inference_mode()
 def predict_batch(self,samples,batch_size=96):
  texts=[]
  for sample in samples:
   text=sample.strip() if isinstance(sample,str) else '\n'.join(t.strip() for t in sample if t and t.strip())
   if not text:raise ValueError('Empty input')
   texts.append(text)
  result=[]
  for start in range(0,len(texts),batch_size):
   tt=texts[start:start+batch_size];features={k:v.to(self.device) for k,v in self.tokenizer(tt,padding=True,truncation=True,max_length=self.config.get('max_length',256),return_tensors='pt').items()}
   with torch.autocast('cuda',dtype=torch.bfloat16,enabled=self.precision=='bf16'):coarse,fine=self.model(features)
   if coarse is not None:
    route=coarse.argmax(1);fine=fine.float().masked_fill(self.model.parent[None,:]!=route[:,None],float('-inf'));coarse_probs=coarse.float().softmax(1).cpu().tolist()
   else:coarse_probs=[None]*len(tt)
   probs=fine.float().softmax(1).cpu().tolist()
   for text,pp,cp in zip(tt,probs,coarse_probs):
    j=max(range(len(self.labels)),key=pp.__getitem__);coarse_id=self.mapping['fine_parent'][j]
    result.append({'text':text,'label':self.labels[j],'coarse_label':self.mapping['coarse_labels'][coarse_id],'score':pp[j],'score_kind':'selected_branch_conditional_probability' if self.structure=='IH' else f'{len(self.labels)}_class_softmax_probability','scores':dict(zip(self.labels,pp)),'coarse_head_scores':dict(zip(self.mapping['coarse_labels'],cp)) if cp is not None else None})
  return result
 def predict(self,text):return self.predict_batch([text])[0]

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--text',required=True);parser.add_argument('--model-dir',type=Path);parser.add_argument('--device',default='auto',choices=['auto','cpu','cuda']);args=parser.parse_args()
 torch.set_num_threads(8);torch.backends.cuda.matmul.allow_tf32=False;torch.backends.cudnn.allow_tf32=False
 print(json.dumps(EmotionPredictor(args.model_dir,args.device).predict(args.text),ensure_ascii=False,indent=2))
