/** Public-only relay for Bulungan Open Tournament Menyumpit 2026.
 * Set GAS_PUBLIC_URL in the Netlify site environment (Apps Script /exec URL).
 * Does not expose operator data, PIN or history to the browser.
 */
const json=(status,body,cache='public, max-age=0, must-revalidate')=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':cache,'Netlify-CDN-Cache-Control':'public, s-maxage=10, stale-while-revalidate=10','Access-Control-Allow-Origin':'*'}});
const categories=new Set(['INDIVIDU PUTRA','INDIVIDU PUTRI','BEREGU CAMPURAN']);
const phases=new Set(['PENYISIHAN','FINAL']);
export default async function handler(request){
  if(request.method!=='GET')return json(405,{ok:false,error:'Method not allowed'});
  const rawUrl=process.env.GAS_PUBLIC_URL;
  if(!rawUrl)return json(503,{ok:false,error:'Konfigurasi GAS_PUBLIC_URL belum tersedia.'});
  let url;
  try{url=new URL(rawUrl)}catch{return json(500,{ok:false,error:'Konfigurasi URL tidak valid.'})}
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname))return json(500,{ok:false,error:'URL harus berakhir /exec dari Apps Script.'});
  url.searchParams.set('view','public');
  const control=new AbortController();const timeout=setTimeout(()=>control.abort(),13500);
  try{
    const res=await fetch(url.toString(),{signal:control.signal,redirect:'follow',headers:{Accept:'application/json'}});
    if(!res.ok)throw Error('HTTP upstream');
    const text=await res.text();if(text.length>1_250_000)throw Error('Response too long');
    const body=JSON.parse(text);if(body.ok!==true||!Array.isArray(body.entries)||!Array.isArray(body.boards))throw Error('Invalid public response');
    const entries=body.entries.filter(x=>categories.has(x.kategori)&&phases.has(x.babak)).map(x=>({
      kategori:String(x.kategori),babak:String(x.babak),peringkat:x.peringkat==null?null:Number(x.peringkat),
      nama:String(x.nama||'').slice(0,160),skor:Number(x.skor)||0,maks:Number(x.maks)||100,
      anggotaSelesai:Number(x.anggotaSelesai)||0,jumlahAnggota:Number(x.jumlahAnggota)||1,
      status:x.status==='LIVE'?'LIVE':'MENUNGGU',seri:Boolean(x.seri)
    }));
    const boards=body.boards.filter(x=>categories.has(x.category)&&phases.has(x.phase)).map(x=>({
      category:String(x.category),phase:String(x.phase),registered:Number(x.registered)||0,done:Number(x.done)||0
    }));
    return json(200,{ok:true,event:'Bulungan Open Tournament Menyumpit 2026',updatedAt:body.updatedAt||null,entries,boards});
  }catch(e){return json(502,{ok:false,error:'Data pertandingan belum dapat diambil. Periksa izin dan versi deployment Apps Script.'},'no-store')}
  finally{clearTimeout(timeout)}
}
