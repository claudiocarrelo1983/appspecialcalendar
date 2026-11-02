export function shouldVibrateInterval(previous,next,timer,foreground){
  return !!previous&&foreground&&timer.mode==='interval'&&timer.status==='running'&&!next.finished
    &&previous.run===timer.runId&&previous.key!==next.round+':'+next.phase
    &&next.elapsed>previous.elapsed&&next.elapsed-previous.elapsed<=2;
}
