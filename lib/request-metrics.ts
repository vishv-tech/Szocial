export class RequestMetrics{
 auth=0;data=0;storage=0;serialization=0;requests=0;started=performance.now();
 record(kind:'auth'|'data'|'storage',duration:number){this[kind]+=duration;this.requests++;}
 json(data:unknown,status=200){const start=performance.now(),body=JSON.stringify(data);this.serialization=performance.now()-start;return new Response(body,{status,headers:{...this.headers(),'Content-Type':'application/json'}});}
 headers(){return {'Cache-Control':'private, no-store','Server-Timing':`total;dur=${(performance.now()-this.started).toFixed(1)},auth;dur=${this.auth.toFixed(1)},data;dur=${this.data.toFixed(1)},storage;dur=${this.storage.toFixed(1)},serialization;dur=${this.serialization.toFixed(2)},requests;desc="${this.requests}"`};}
}
