// Audio-thread capture. Transfer short PCM buffers without doing network work here.
class HelloEarthPCM extends AudioWorkletProcessor {
 constructor(){
  super();this.buffer=new Float32Array(2048);this.used=0;this.active=true;
  this.port.onmessage=e=>{if(e.data?.type==="flush"){this.active=false;this.emit();this.port.postMessage({type:"flushed"})}};
 }
 emit(){if(!this.used)return;const samples=this.buffer.slice(0,this.used);this.port.postMessage({type:"pcm",samples},[samples.buffer]);this.used=0;}
 process(inputs,outputs){
  const input=inputs[0];if(this.active&&input?.length){const len=input[0].length;
   for(let i=0;i<len;i++){let value=0;for(const channel of input)value+=channel[i]||0;this.buffer[this.used++]=value/input.length;if(this.used===this.buffer.length)this.emit()}
  }
  for(const out of outputs)for(const channel of out)channel.fill(0);
  return true;
 }
}
registerProcessor("helloearth-pcm",HelloEarthPCM);
