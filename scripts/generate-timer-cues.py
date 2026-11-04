"""Generate original, short PCM cues for native workout notifications."""
from pathlib import Path
import math, struct, wave
folder=Path(__file__).resolve().parent.parent/'src/assets/audio'
folder.mkdir(parents=True,exist_ok=True)
rate=22050
for name,notes in {'work':[(660,.14),(990,.22)],'rest':[(440,.22),(330,.30)],'finished':[(523.25,.18),(659.25,.18),(783.99,.48)]}.items():
 samples=[]
 for frequency,duration in notes:
  count=int(duration*rate)
  for index in range(count):
   time=index/rate
   envelope=min(1,time/.015,(duration-time)/.06)
   value=.42*max(0,envelope)*(math.sin(2*math.pi*frequency*time)+.15*math.sin(4*math.pi*frequency*time))/1.15
   samples.append(int(value*32767))
  samples.extend([0]*int(.09*rate))
 with wave.open(str(folder/('gym_timer_'+name+'.wav')),'wb') as output:
  output.setnchannels(1);output.setsampwidth(2);output.setframerate(rate)
  output.writeframes(struct.pack('<'+'h'*len(samples),*samples))
 print(name,len(samples)/rate,'seconds')
