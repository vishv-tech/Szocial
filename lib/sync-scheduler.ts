/** Coalesces events per resource, with one trailing request for changes during a fetch. */
export class SyncScheduler{
 private queued=new Set<string>();private pending=new Map<string,Promise<void>>();private timer?:ReturnType<typeof setTimeout>;private stopped=false;
 constructor(private fetchResource:(key:string)=>Promise<void>,private visible:()=>boolean,private delay=200){}
 schedule(key:string){if(this.stopped)return;this.queued.add(key);clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),this.delay);}
 async flush(){if(this.stopped||!this.visible())return;const keys=[...this.queued];this.queued.clear();await Promise.all(keys.map(async key=>{if(this.pending.has(key)){this.queued.add(key);return;}const task=this.fetchResource(key);this.pending.set(key,task);try{await task;}finally{this.pending.delete(key);if(this.queued.size&&!this.stopped)this.timer=setTimeout(()=>void this.flush(),this.delay);}}));}
 reset(){clearTimeout(this.timer);this.queued.clear();}
 stop(){this.stopped=true;clearTimeout(this.timer);this.queued.clear();}
}
