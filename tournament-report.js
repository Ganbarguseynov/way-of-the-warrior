/* Сообщает серверу победителя турнирного матча.
   Срабатывает только если в sessionStorage лежит tmatch (ставит chess-tournament.html). */
(function(){
  var SB_URL='https://qnpriwfxzuoymoumdtrl.supabase.co';
  var SB_KEY='sb_publishable_1jTWcnb3WvNMi79DXYU7Tw_RWKIVcsF';

  function playerKey(){
    var t=localStorage.getItem('tgId'); if(t) return 'tg:'+t;
    var e=localStorage.getItem('currentEmail')||localStorage.getItem('linkedEmail');
    if(e) return 'email:'+e.toLowerCase();
    var a=localStorage.getItem('arenaAnonId');
    if(!a){ a='anon:'+Math.random().toString(36).slice(2,10); localStorage.setItem('arenaAnonId',a); }
    return a;
  }

  function attach(){
    if(!window.Net||typeof Net.on!=='function'||!window.supabase){ setTimeout(attach,200); return; }
    var sb=supabase.createClient(SB_URL,SB_KEY);

    Net.on('result',function(r){
      var mid=sessionStorage.getItem('tmatch');
      if(!mid||!r) return;
      sessionStorage.removeItem('tmatch');
      if(!r.winner||r.winner==='draw') return;
      if(r.winner!==r.mySide) return;
      sb.rpc('t_win',{p_key:playerKey(),p_mid:mid}).then(function(){}).catch(function(){});
    });
  }
  attach();
})();