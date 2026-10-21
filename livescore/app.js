(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const CATEGORY=['INDIVIDU PUTRA','INDIVIDU PUTRI','BEREGU CAMPURAN'];
  const PHASE=['PENYISIHAN','FINAL'];
  const PHASE_NAME={PENYISIHAN:'Penyisihan',FINAL:'Final'};
  const state={category:CATEGORY[0],phase:PHASE[0],entries:[],boards:[],updatedAt:null,connected:false,demo:new URLSearchParams(location.search).get('demo')==='1',filter:'',page:1,pageSize:15,pending:false,lastSuccess:0};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleCase=v=>String(v||'').toLowerCase().replace(/\b\w/g,s=>s.toUpperCase());
  const formatNum=n=>new Intl.NumberFormat('id-ID').format(Number(n)||0);
  const isComplete=x=>x.status==='LIVE'||x.status==='RESMI';
  const showError=s=>{const n=$('errorBar');n.textContent=s;n.hidden=false};
  const clearError=()=>{$('errorBar').hidden=true};
  const maxScore=()=>state.category==='BEREGU CAMPURAN'?300:100;
  function fmtWita(timestamp){if(!timestamp)return 'Belum ada nilai masuk';try{
    const d=new Date(timestamp);if(!Number.isFinite(d.valueOf()))return 'Belum ada nilai masuk';
    return 'Update '+new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Makassar',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d)+' WITA';
  }catch{return 'Pembaruan tersedia'}}
  function board(){return state.boards.find(x=>x.category===state.category&&x.phase===state.phase)}
  function viewItems(){return state.entries.filter(x=>x.kategori===state.category&&x.babak===state.phase)}
  function sortedEntries(){const a=viewItems();const completed=a.filter(isComplete).sort((x,y)=>Number(y.skor)-Number(x.skor)||String(x.nama).localeCompare(String(y.nama),'id'));
    const partial=a.filter(x=>!isComplete(x)).sort((x,y)=>Number(y.anggotaSelesai)-Number(x.anggotaSelesai)||Number(y.skor)-Number(x.skor));
    return [...completed,...partial]}
  function positions(){return sortedEntries().filter(isComplete)}
  function medalCard(x,rank){
    const boxClass=rank===1?'champion':rank===3?'third':'';
    if(!x)return `<div class="podium-card empty ${boxClass}"><span class="number">0${rank}</span><span>Menunggu peringkat</span></div>`;
    const tied=positions().some(y=>y!==x&&Number(y.skor)===Number(x.skor));
    return `<article class="podium-card ${boxClass}"><div class="podium-top"><span class="medal">0${rank}</span><span class="place-label">POSISI ${esc(x.peringkat??rank)}</span></div>${tied?'<span class="tie-note">SKOR SERI</span>':''}<div class="podium-name">${esc(x.nama)}</div><div class="podium-score"><strong>${formatNum(x.skor)}</strong><small>/ ${maxScore()} POIN</small></div></article>`;
  }
  const awards={1:'JUARA 1',2:'JUARA 2',3:'JUARA 3',4:'HARAPAN 1',5:'HARAPAN 2',6:'HARAPAN 3'};
  function finalistWall(){
    const enabled=state.phase==='FINAL';
    document.body.classList.toggle('final-board-mode',enabled);
    const outer=$('finalWall');if(!outer)return;outer.hidden=!enabled;
    if(!enabled)return;
    const data=sortedEntries().slice(0,20), complete=data.filter(isComplete);
    const allFinished=data.length===20&&complete.length===20;
    const tieAt=(x)=>isComplete(x)&&complete.some(y=>y!==x&&Number(y.skor)===Number(x.skor));
    const leadersTied=complete.some(x=>Number(x.peringkat)>=1&&Number(x.peringkat)<=6&&tieAt(x));
    const official=allFinished&&!leadersTied;
    const categoryLabel=state.category==='BEREGU CAMPURAN'?'BEREGU CAMPURAN':state.category;
    $('finalWallTitle').innerHTML='FINAL <span>'+esc(categoryLabel)+'</span>';
    $('finalWallSubtitle').textContent=official?'Semua 20 hasil selesai · enam peringkat teratas berdasarkan skor final':'20 finalis · skor sementara dimulai 0 · hasil berubah saat juri memasukkan nilai';
    $('finalWallCount').textContent=complete.length+' dari '+data.length+' selesai';
    $('finalWallNote').textContent=official?'Penetapan juara mengikuti hasil final dan keputusan panitia.':'Peringkat sementara; juara belum ditetapkan sampai semua finalis selesai dan seri terselesaikan.';
    $('finalWallGrid').innerHTML=data.length?data.map((x,i)=>{
      const live=isComplete(x),rank=live?Number(x.peringkat)||i+1:null;
      const tied=live&&tieAt(x);
      const award=live&&!tied&&rank>=1&&rank<=6?awards[rank]:'';
      const badge=award?(official?award:'POSISI SEMENTARA '+rank):tied?'SKOR SERI':live?'SELESAI':Number(x.anggotaSelesai)>0?'PROSES':'MENUNGGU';
      const cssRank=award?' winner winner-'+rank:'';
      const dataStatus=live?'scored':'waiting';
      const progress=state.category==='BEREGU CAMPURAN'&& !live ?'<small>'+Math.min(Number(x.anggotaSelesai)||0,3)+'/3 anggota</small>':'';
      return `<article class="final-entry ${dataStatus}${cssRank}${award&&!official?' provisional':''}" aria-label="${esc(x.nama)}: ${live?`nilai ${x.skor}`:'menunggu nilai'}">
        <span class="final-entry-num">${live&&rank?String(rank).padStart(2,'0'):String(i+1).padStart(2,'0')}</span>
        <span class="final-entry-copy"><strong title="${esc(x.nama)}">${esc(x.nama)}</strong><small>${esc(badge)}</small></span>
        <span class="final-entry-score">${formatNum(x.skor)}<small>/${maxScore()}</small>${progress}</span>
      </article>`;
    }).join(''):'<div class="final-empty">Daftar finalis belum tersedia dari Apps Script.</div>';
  }
  function render(){
    document.querySelectorAll('[data-category]').forEach(b=>{const on=b.dataset.category===state.category;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
    document.querySelectorAll('[data-phase]').forEach(b=>{const on=b.dataset.phase===state.phase;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
    const b=board();const a=sortedEntries();const done=a.filter(isComplete);const n=b?Number(b.registered)||0:state.phase==='FINAL'?0:undefined;
    $('metricRegistered').textContent=n===undefined?'—':formatNum(n);
    $('metricCompleted').textContent=formatNum(b?.done??done.length);
    $('metricHighest').textContent=done.length?formatNum(Math.max(...done.map(x=>Number(x.skor)||0))):'—';
    $('metricMax').textContent=' / '+maxScore();
    const status=done.length===0?(state.phase==='FINAL'&&!b?'Belum dibuka':'Menunggu'):(n>0&&done.length===n?'Selesai':'Berjalan');
    $('metricStatus').textContent=status;
    $('metricStatusDetail').textContent=state.phase==='FINAL'?'Babak final':'Babak penyisihan';
    $('rankCategory').textContent=state.category;
    $('podium').innerHTML=[medalCard(done[1],2),medalCard(done[0],1),medalCard(done[2],3)].join('');
    $('boardSubtitle').textContent=state.phase==='FINAL'?'Final dimulai dari nol; riwayat penyisihan tetap tersimpan.':'Urutan sementara berdasarkan nilai yang masuk.';
    $('asideCategory').textContent=titleCase(state.category);
    $('asideDistance').textContent=(state.category==='INDIVIDU PUTRA'?25:20)+' meter';
    $('asideShots').textContent=state.category==='BEREGU CAMPURAN'?'30 / regu':'10 / atlet';
    $('asideMaximum').textContent=maxScore()+' poin';
    $('entriesCount').textContent=(a.length)+' HASIL';
    const query=state.filter.toLocaleLowerCase('id-ID');
    const filtered=a.filter(x=>String(x.nama||'').toLocaleLowerCase('id-ID').includes(query));
    const maxPage=Math.max(1,Math.ceil(filtered.length/state.pageSize));state.page=Math.min(Math.max(1,state.page),maxPage);
    const from=(state.page-1)*state.pageSize;const rows=filtered.slice(from,from+state.pageSize);
    $('resultsNote').textContent=filtered.length===a.length?'Hasil tercatat':`${filtered.length} cocok`;
    $('boardRows').innerHTML=rows.length?rows.map((x,i)=>{
      const complete=isComplete(x);const actualRank=complete?(x.peringkat??a.indexOf(x)+1):'—';
      const same=complete&&done.some(y=>y!==x&&Number(y.skor)===Number(x.skor));
      const partialProgress=Number(x.anggotaSelesai)||0;
      const total=Number(x.jumlahAnggota)||1;
      const label=same?'SERI':complete?'LIVE':partialProgress?'PROSES':'MENUNGGU';
      const cls=same?'tie':complete?'live':'partial';
      const detail=state.category==='BEREGU CAMPURAN'?`Regu campuran · ${PHASE_NAME[state.phase]}`:`${titleCase(state.category)} · ${PHASE_NAME[state.phase]}`;
      return `<tr><td><span class="position ${complete&&Number(actualRank)<=3?'top':''}">${esc(actualRank)}</span></td><td><span class="person-name" title="${esc(x.nama)}">${esc(x.nama)}</span><span class="person-sub">${esc(detail)}</span></td><td><span class="score-num">${formatNum(x.skor)}<span class="score-max"> / ${maxScore()}</span></span></td><td><span class="progress">${partialProgress} / ${total}</span></td><td><span class="tag ${cls}">${label}</span></td></tr>`;
    }).join(''):`<tr><td colspan="5" class="table-empty">${query?'Tidak ada nama yang cocok dengan pencarian.':state.phase==='FINAL'&&!b?'Babak final belum dibuka oleh Admin.':'Belum ada skor masuk pada kategori dan babak ini.'}</td></tr>`;
    $('paginationInfo').textContent=filtered.length?`Menampilkan ${from+1}–${Math.min(from+state.pageSize,filtered.length)} dari ${filtered.length} hasil`:'Belum ada hasil';
    $('pageInfo').textContent=`${state.page} / ${maxPage}`;$('prevPage').disabled=state.page===1;$('nextPage').disabled=state.page===maxPage;
    const anySaved=state.entries.some(x=>Number(x.anggotaSelesai)>0);
    $('updatedLabel').textContent=anySaved?fmtWita(state.updatedAt):'Belum ada nilai masuk';
    const light=$('connectionLight');light.className='light '+(state.connected?(anySaved?'live':'wait'):'offline');
    $('connectionLabel').textContent=state.demo?'MODE DEMO · BUKAN NILAI ASLI':state.connected?(anySaved?'Skor pertandingan terkoneksi':'Terkoneksi · menunggu nilai'):'Menunggu koneksi Live Score';
    finalistWall();
  }
  function demoData(){
    const entries=[];const boards=[];
    const map={ 'INDIVIDU PUTRA':219,'INDIVIDU PUTRI':118,'BEREGU CAMPURAN':86};
    CATEGORY.forEach((category,ci)=>PHASE.forEach((phase,pi)=>{
      const count=pi?20:map[category];const isTeam=ci===2;
      const scores=pi?7:11;
      const set=[];
      for(let i=0;i<scores;i++){
        const max=isTeam?300:100;const value=Math.max(1,max-(isTeam?14:6)*i-(pi?7:1));
        const isPartial=isTeam&&i===scores-1;
        const item={kategori:category,babak:phase,peringkat:isPartial?null:i+1,nama:isTeam?`Regu Simulasi ${String.fromCharCode(65+i)}`:`Atlet Simulasi ${String.fromCharCode(65+i)}`,skor:value,maks:max,anggotaSelesai:isPartial?2:isTeam?3:1,jumlahAnggota:isTeam?3:1,status:isPartial?'MENUNGGU':'LIVE',seri:false};
        set.push(item);entries.push(item);
      }
      boards.push({category,phase,registered:count,done:set.filter(isComplete).length});
    }));
    return {entries,boards,updatedAt:new Date().toISOString(),ok:true};
  }
  async function reload(){
    if(state.demo){const d=demoData();state.entries=d.entries;state.boards=d.boards;state.updatedAt=d.updatedAt;state.connected=true;state.lastSuccess=Date.now();render();return}
    if(state.pending)return;state.pending=true;document.body.classList.add('loading');
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),14500);
    try{
      const response=await fetch('/.netlify/functions/livescore',{signal:ctrl.signal,headers:{Accept:'application/json'},cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(!data||data.ok!==true||!Array.isArray(data.entries)||!Array.isArray(data.boards))throw Error('Format data Live Score tidak sesuai');
      state.entries=data.entries.filter(x=>x&&CATEGORY.includes(x.kategori)&&PHASE.includes(x.babak)&&typeof x.nama==='string');
      state.boards=data.boards.filter(x=>x&&CATEGORY.includes(x.category)&&PHASE.includes(x.phase));
      state.updatedAt=data.updatedAt||null;state.connected=true;state.lastSuccess=Date.now();clearError();render();
    }catch(err){
      state.connected=false;render();showError('Koneksi skor belum tersedia. Data terakhir akan tetap ditampilkan bila sebelumnya pernah dimuat. '+(err.name==='AbortError'?'Permintaan melewati batas waktu.':'Mohon periksa pengaturan endpoint Netlify.'));
      // Developer details intentionally not exposed to public audiences.
    }finally{clearTimeout(timer);state.pending=false;document.body.classList.remove('loading')}
  }
  document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;state.page=1;render()}));
  document.querySelectorAll('[data-phase]').forEach(b=>b.addEventListener('click',()=>{state.phase=b.dataset.phase;state.page=1;state.pageSize=state.phase==='FINAL'?20:15;render()}));
  $('searchInput').addEventListener('input',e=>{state.filter=e.target.value.trim();state.page=1;render()});
  $('prevPage').addEventListener('click',()=>{state.page--;render()});$('nextPage').addEventListener('click',()=>{state.page++;render()});
  $('refreshBtn').addEventListener('click',reload);
  $('ledBtn').addEventListener('click',async()=>{
    const isLed=!document.body.classList.contains('led');document.body.classList.toggle('led',isLed);$('ledBtn').textContent=isLed?'▤ Mode Normal':'▣ Mode LED';
    if(isLed&&document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen()}catch{}}
    else if(!isLed&&document.fullscreenElement&&document.exitFullscreen){try{await document.exitFullscreen()}catch{}}
  });
  if(state.demo)$('demoBanner').hidden=false;
  render();reload();setInterval(reload,12000);
  setInterval(()=>{if(!state.demo&&state.lastSuccess&&Date.now()-state.lastSuccess>90000){state.connected=false;render();showError('Data skor belum diperbarui selama lebih dari 90 detik. Periksa koneksi internet.') }},30000);
})();
