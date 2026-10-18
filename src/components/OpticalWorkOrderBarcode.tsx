import { useMemo } from "react";

/** Code 39 for locator-only work-order references. This is NOT a payment token. */
const patterns:Record<string,string>={
  "0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn",
  "4":"nnnwwnnnw","5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw",
  "8":"wnnwnnwnn","9":"nnwwnnwnn","A":"wnnnnwnnw","B":"nnwnnwnnw",
  "C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn",
  "G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn",
  "K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww",
  "O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn",
  "S":"nnwnnnwwn","T":"nnnnwnwwn","U":"wwwnnnnnn","V":"nwwnnnnnw",
  "W":"wwnnnnnnw","X":"nwnnwnnnw","Y":"wwwnwnnnn","Z":"nwwnwnnnn",
  "-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","$":"nwnwnwnnn",
  "/":"nwnwnnnwn","+":"nwnnnwnwn","%":"nnnwnwnwn","*":"nwnnwnwnn"
};
export const opticalWorkOrderLocator=(id:string)=>{
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return null;
  return "WO-"+id.toUpperCase();
};
export function code39Bars(value:string):{width:number,bars:Array<{x:number,width:number}>}|null{
  if(!value || !Array.from(value).every(char=>char!=="*"&&Boolean(patterns[char])))return null;
  const text="*"+value+"*";
  const bars:Array<{x:number,width:number}>=[];
  let x=12;
  for(const char of text){
    patterns[char].split("").forEach((kind,i)=>{
      const width=kind==="w"?3:1;
      if(i%2===0)bars.push({x,width});
      x+=width;
    });
    x+=1;
  }
  return {width:x+12,bars};
}
export function OpticalWorkOrderBarcode({id}:{id:string}){
  const locator=opticalWorkOrderLocator(id);
  const bars=useMemo(()=>locator?code39Bars(locator):null,[locator]);
  if(!locator||!bars)return null;
  return <svg viewBox={`0 0 ${bars.width} 92`} role="img" aria-label={`Work order barcode ${locator}`}
    style={{width:"100%",maxWidth:"620px",height:"auto"}} xmlns="http://www.w3.org/2000/svg">
    <rect width={bars.width} height="92" fill="white"/>
    {bars.bars.map((bar,i)=><rect key={i} x={bar.x} y={5} width={bar.width} height={58} fill="black"/>)}
    <text x={bars.width/2} y={81} fontSize="12" textAnchor="middle" fill="black">{locator}</text>
  </svg>;
}
