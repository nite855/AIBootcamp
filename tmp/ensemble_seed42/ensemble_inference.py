"""50:50 soft voting. Point --ensemble-dir to an exported ensemble_seed folder."""
import argparse,json
from pathlib import Path
from inference_example import EmotionPredictor

class EnsemblePredictor:
 def __init__(self,folder=None,device='auto',precision='bf16'):
  self.folder=Path(folder or Path(__file__).resolve().parent);self.manifest=json.loads((self.folder/'ensemble.json').read_text(encoding='utf8'));self.labels=self.manifest['labels'];self.models=[]
  for c in self.manifest['components']:
   path=Path(c['folder'])
   if not path.exists():path=self.folder.parent/path.name
   model=EmotionPredictor(path,device=device,precision=precision);assert model.labels==self.labels;self.models.append(model)
 def predict_batch(self,texts,batch_size=96):
  predictions=[m.predict_batch(texts,batch_size) for m in self.models];out=[];mapping=self.models[0].mapping
  for i in range(len(predictions[0])):
   scores={l:sum(w*predictions[j][i]['scores'][l] for j,w in enumerate(self.manifest['weights'])) for l in self.labels};label=max(self.labels,key=scores.__getitem__);coarse=mapping['coarse_labels'][mapping['fine_parent'][self.labels.index(label)]];out.append({'text':predictions[0][i]['text'],'label':label,'coarse_label':coarse,'score':scores[label],'scores':scores,'score_kind':'50:50 mean of9class probabilities'})
  return out
 def predict(self,text):return self.predict_batch([text])[0]

if __name__=='__main__':
 import torch
 torch.set_num_threads(8);torch.backends.cuda.matmul.allow_tf32=False;torch.backends.cudnn.allow_tf32=False
 p=argparse.ArgumentParser();p.add_argument('--ensemble-dir',type=Path);p.add_argument('--text',required=True);p.add_argument('--device',default='auto');a=p.parse_args();print(json.dumps(EnsemblePredictor(a.ensemble_dir,a.device).predict(a.text),ensure_ascii=False,indent=2))
