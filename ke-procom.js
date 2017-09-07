'use strict';
const Hp=require('http');
const Ml=require('nodemailer');
const Fs=require('fs');
let keChatwork=require('ke-chatwork');
module.exports=class keProcom extends keChatwork {
/**
 * オブジェクト’コンストラクション
 * @param  {String} tokenChat Chatwork用トークン
 * @param  {String} tokenGit  Gitlab用トークン
 * @return {void}           none
 * @constructor
 */
  constructor(tokenChat, tokenGit) { // オブジェクトコンストラクション
    super(tokenChat);
    this.GitlabParas={};
    this.GitlabParas.private_token=tokenGit;
  }
/**
 * サーバー定義
 * @param  {function} proc セッション処理
 * @param  {object} op   環境オプションオーバーライド
 * @return {void}      none
 * @method
 */
  server(proc, op) { // サーバー定義
    const me=this;
    op=op||{}; op.port=op.port||8088;
    me.info(op.group);
    for(var k in op){me.CFG[k]=op[k];}
    me.PROCOM={time: {}};
    Hp.createServer(function(req, res){
      me.Fibers(function(){
        proc(me, req, res);
      }).run(this);
    }).listen(op.port);
    me.infoLog('サーバーを開始しました。');
  }
/**
   * Gitlabからのwebhook処理
   * @param  {string} msg webhookメッセージ
   * @return {void}     none
   * @method
   */
  processGitlab(msg) { // Gitlabからのwebhook処理
    let o, x, y, c, p, objs='', branch;
    try{
      o=JSON.parse(msg);
    }catch(e){
      o={}; o.object_kind=msg;
    }
    switch (o.object_kind) {
    case 'push':
      console.log(o.user_name, o.project.name, o.ref);
      for(x in o.commits) {
        console.log(o.commits[x].id, o.commits[x].message);
        c=''; for(y in o.commits[x].added) {
          objs+=c+o.commits[x].added[y]; c=',';
        }
        for(y in o.commits[x].modified) {
          objs+=c+o.commits[x].modified[y]; c=',';
        }
        for(y in o.commits[x].removed) {
          objs+=c+o.commits[x].removed[y]; c=',';
        }
        p=o.ref.indexOf('#');
        branch=o.ref.substr(p+1);
        console.log('branch='+branch+' obj='+objs);
      }
      break;
    default:
      this.infoLog('ignore object=' + o.object_kind);
    }
  }
/**
   * redmineからのwebhookとREST API
   * @param  {string} msg webhookメッセージ
   * @return {void}     none
   * @method
   */
  processRedmine(msg) { // redmineからのwebhookとREST API
    let o, me=this;
    try{
      o=JSON.parse(msg).payload;
    }catch(e){
      o={}; o.action='error JSON';
    }
    let j=o.journal;
    switch (o.action) {
    case 'update':
      if(o.status.name=='終了(F)') {for(let i in j.details) {
        if( j.details[i].prop_key == 'status_id') {
          if(j.details[i].old_value != '5') {
            me.pushMessage('作業が終了しました。', 'project-ha');
            console.log(o.issue);
            break;
          }
        }
      }}
      if(o.status.name=='指示(O)') {for(let i in j.details) {
        if( j.details[i].prop_key == 'status_id') {
          if(j.details[i].old_value != '2') {
            me.pushMessage('作業がオーダーされました。', 'project-ha');
            console.log(o.issue);
            break;
          }
        }
      }}
      if(o.status.name=='実施(E)') {for(let i in j.details) {
        if( j.details[i].prop_key == 'status_id') {
          if(j.details[i].old_value == '4') {
            me.pushMessage('保留が解除されました。', 'project-ha');
            console.log(o.issue);
            break;
          }
          if(j.details[i].old_value != '3') {
            me.pushMessage('作業を開始しました。', 'project-ha');
            console.log(o.issue);
            break;
          }
        }
      }}
      if(o.status.name=='精査(P)') {for(let i in j.details) {
        if( j.details[i].prop_key == 'status_id') {
          if(j.details[i].old_value != '6') {
            me.pushMessage('精査が終了しました。', 'project-ha');
            console.log(o.issue);
            break;
          }
        }
      }}
      if(o.status.name=='中止(Q)') {for(let i in j.details) {
        if( j.details[i].prop_key == 'status_id') {
          if(j.details[i].old_value != '7') {
            me.pushMessage('工程は中止されました。', 'project-ha');
            console.log(o.issue);
            break;
          }
        }
      }}
      if(o.status.name=='保留(H)') {for(let i in j.details) {
        if( j.details[i].prop_key == 'status_id') {
          if(j.details[i].old_value != '4') {
            me.pushMessage('作業は保留されました。', 'project-ha');
            console.log(o.issue);
            break;
          }
        }
      }}
      break;
    default:
      this.infoLog('ignore object=' + o.object_kind);
    }
  }
/**
 * ユーザーからの報告処理
 * @return {void} none
 * @method
 */
  processReport() { // ユーザーからの報告処理
    let me=this, d, out={};
    switch(me.SS.PATH[2]) {
    case 'finish':
      out.type='text/plane';
      out.data=me.redmine('finish', {'id': me.SS.PATH[3]-0});
      break;
    case 'pass':
      out.type='text/plane';
      out.data=me.redmine('pass', {'id': me.SS.PATH[3]-0});
      break;
    case 'ticket':
      d=me.SS.DATA['code'];
      out.type='text/plane';
      out.data=me.getUrl('ticket', [d, 1]);
      break;
    default:
      out=false;
    }
    return out;
  }
/**
   * ガントチャートインターフェイス
   * @param  {string} x      メッセージ
   * @param  {string} method RESTメソッド
   * @return {object}        返信メッセージ{false/type, data}
   * @method
   */
  processGantt(x, method) { // ガントチャートインターフェイス
    let me=this, i, data, path, base, out={}, prj, rc;
    switch(method) {
    case 'get':
      i=me.SS.PATH.length-1, path=me.SS.PATH[i];
      if(path=='project.json') {
        prj=me.SS.URI.search.substr(1);
        out.type='application/json';
        if(me.find('project', prj)=='error'){return false;}
        data=me.redToGantt(prj);
        if(!data){
          out.data=JSON.stringify(me.newTracker(prj));
          //console.log('#207', out.data);
        }else{
          data={'tasks': data};
          me.redUser();
          data.resources=me.Users;
          me.redRole();
          data.roles=me.Roles;
          data.canWrite=true;
          data.canWriteOnParent=true;
          data.zoom='m';
          out.data=JSON.stringify(data);
        }
        return out;
      }else{
        base='../';
        for(i in me.SS.PATH) {if (i>0 && i<me.SS.PATH.length-1){
          base+=me.SS.PATH[i]+'/';
        }}
      }
      try {
        data=Fs.readFileSync(base+path);
        out.type=me.ctype(me.modifier(path));
        if(me.modifier(path)=='html') {
          out.data=data.toString('utf-8')+'';
        }else{
          out.data=data;
        }
      }catch(e) {
        me.infoLog('read file 404:'+base+path);
        out=false;
      }
      return out;
    case 'post':
      try{
        rc=me.ganttToRed(JSON.parse(x), true);
        Fs.writeFileSync('../data/project-'+me.SS.URI.search.substr(1)+'.json', x);
        out.data={'ok': 'project.json', 'rc': rc};
      }catch(e){
        out.data={
          'ng': 'project.json',
          'message': 'データ書き込みが失敗しました。',
          'errorMessages': e
        };
        me.errorLog('データ書き込みが失敗しました。', e);
      }
      out.type='applicaiton/json';
    }
    return out;
  }
/**
 * redmine REST API
 * @param  {String} method 処理対象
 * @param  {Object} op     オプションデータ
 * @return {Void}        none
 * @method
 */
  redmine(method, op) { // redmine REST API
    let me=this, body, path;
    switch(method){
    case 'ticket':
      body=me.redIssue(op);
      path='/issues.json';
      break;
    case 'finish':
      body=me.redIssueUp(method);
      path='/issues/'+op.id+'.json';
      break;
    default:
    }
    me.postRequest(
      {hostname: me.hostname, path: path, port: 8088},
       body,
       false
    );
  }
/**
   * redmine IssueレコードJSON編集
   * @param  {Object} op パラメータ
   * @return {JSON}    Issueレコード
   * @method
   */
  redIssue(op) { // redmine IssueレコードJSON編集
    return {
      'issue': {
        'project_id': op.project,
        'tracker_id': op.tracker,
        'status_id': 1,
        'subject': op.subject,
        'description': op.descrition,
        'assigned_to_id': op.assign,
        'fixed_version_id':2,
        'parent_issue_id': op.parent,
        'custom_field_values': op.custom
      }
    };
  }
/**
 * redmine Issue 更新編集
 * @param  {String} cmd ステータス名
 * @return {JSON}     REST更新インターフェイス
 * @method
 */
  redIssueUp(cmd) { // redmine Issue 更新編集
    switch(cmd) {
    case 'finish':
      return {'issue': {'status': {'id': 5}}};
    case 'pass':
      return {'issue': {'status': {'id': 6}}};
    default:
    }
  }
/**
 * ユーザー追加インターフェイス編集
 * @param  {Object}  dt      ユーザーデータオブジェクト(Standard)
 * @param  {Boolean} command コマンド発行(true/false)省略時false
 * @return {Object}          編集結果 or true/false(command=true時)
 * @method
 */
  redUserAdd(dt, command) { // ユーザー追加インターフェイス編集
    let me=this, i, o, out=[];
    for(i in dt.user){
      o={};
      o.login=dt.user[i].username;
      o.password=dt.user[i].password;
      o.lastname=dt.user[i].lastname;
      o.firstname=dt.user[i].firstname;
      o.mail=dt.user[i].email;
      o.custom_fields=[];
      o.custom_fileds[0]={};
      o.custom_fileds[0].id=2;
      o.custom_fileds[0].name='shortname';
      o.custom_fileds[0].value=dt.user[i].shortname;
      if(command){
        if(!me.commands(['../cli/xaRedmine user x ' + JSON.stringify(o)])){
          return false;
        }
      }else{
        out[i]=o;
      }
    }
    if(!command){
      return true;
    }else{
      return out;
    }
  }
/**
   * ユーザー追加CSVインターフェイス編集
   * @param  {Object} dt ユーザーデータオブジェクト(Standard)
   * @return {Object}    csv用配列
   * @method
   */
  redUserCsv(dt) { // ユーザー追加CSVインターフェイス編集
    let out=[];
    out[0]=[
      'login', 'password', 'lastname', 'firstname', 'mail', 'admin'
    ];
    for(let i in dt) {
      out[i+1]=[
        dt[i].userid, dt[i].password, dt[i].lastname,
        dt[i].firstname, dt[i].mail, false
      ];
    }
    return out;
  }
/**
 * redmineテーブル取得RESTチケット
 * @param  {String} pid プロジェクトID(省略時は全プロジェクト)
 * @return {Object}     プロジェクトテーブル
 * @method
 */
  redTicket(pid) { // redmineテーブル取得RESTチケット
    let me=this, out=[], level={};
    try {
      if(pid){me.shell('../cli/xaRedmine list '+pid);}
      else{me.shell('../cli/xaRedmine ls issues');}
      let o=JSON.parse(me.stdout).issues;
      let x;

      for(let i in o) {
        x=o[i]; out[i]={};
        level[x.id]=2;
        out[i]={
          'id': x.id,
          'project_id': x.project.id,
          'project_name': x.project.name,
          'tracker_id': x.tracker.id,
          'tracker_name': x.tracker.name,
          'status_id': x.status.id,
          'status_name': x.status.name,
          'priority_id': x.priority.id,
          'priority_name': x.priority.name,
          'author_id': x.author.id,
          'author_name': x.author.name,
          'subject': x.subject,
          'description': x.description,
          'start_date': x.start_date,
          'due_date': x.due_date,
          'done_ratio': x.done_ratio,
          'estimated_hours': x.estimated_hours,
          'created_on': x.created_on,
          'updated_on': x.updated_on
        };
        if(x.assigned_to){
          out[i].assigned_id=x.assigned_to.id;
          out[i].assigned_name=x.assigned_to.name;
        }
        if(x.custom_fields){
          let j; for(j in x.custom_fields){
            out[i][x.custom_fields[j].name]=x.custom_fields[j].value;
          }
        }
      }
      out=me.sort(out, ['tracker_id', 'start_date']);
      Fs.writeFileSync('../data/red-ticket-'+pid, JSON.stringify(out));
    }catch(e) {
      me.errorLog('write error', e);
      out=[];
    }
    return out;
  }
/**
   * redmine テーブル取得REST プロジェクト
   * @return {Object} プロジェクトテーブル
   * @method
   */
  redProject() { // redmine テーブル取得REST プロジェクト
    let me=this, out=[];
    if(me.unixStamp(me.PROCOM.time.project)){
      try {
        me.shell('../cli/xaRedmine ls projects');
        let o=JSON.parse(me.stdout);
        let x;
        for(let i in o.projects) {
          x=o.projects[i]; out[i]={};
          out[i]={
            'id': x.id,
            'name': x.name,
            'identifier': x.identifier,
            'description': x.description,
            'created_on': x.created_on,
            'updated_on': x.updated_on
          };
        }
        me.Project=out;
        Fs.writeFileSync('../data/red-project', JSON.stringify(out));
      }catch(e) {
        console.log(e);
        me.errorLog('write error', e);
        out=me.Project;
      }
    }else{
      out=me.Project();
    }
    return out;
  }
/**
 * redmine テーブル取得REST トラッカー
 * @return {Object} トラッカーテーブル
 * @method
 */
  redTracker() { // redmine テーブル取得REST トラッカー
    let me=this, out=[];
    if(me.unixStamp(me.PROCOM.time.tracker)){
      try {
        me.shell('../cli/xaRedmine ls trackers');
        let o=JSON.parse(me.stdout);
        let x;
        for(let i in o.trackers) {
          x=o.trackers[i]; out[i]={};
          out[i]={
            'id': x.id,
            'name': x.name,
          };
        }
        me.Tracker=out;
        Fs.writeFileSync('../data/red-tracker', JSON.stringify(out));
      }catch(e) {
        me.errorLog('write error', e);
        out=me.Tracker||[];
      }
    }else{
      out=me.Tracker;
    }
    return out;
  }
/**
 * redmine テーブル取得REST ロール
 * @return {Object} ロールテービル
 * @method
 */
  redRole() { // redmine テーブル取得REST ロール
    let me=this, out=[];
    if(me.unixStamp(me.PROCOM.time.role)){
      try {
        me.shell('../cli/xaRedmine ls roles');
        let o=JSON.parse(me.stdout);
        let x;
        for(let i in o.roles) {
          x=o.roles[i]; out[i]={};
          out[i]={
            'id': x.id,
            'name': x.name,
          };
        }
        me.Roles=out;
        Fs.writeFileSync('../data/red-role', JSON.stringify(out));
      }catch(e) {
        me.errorLog('write error', e);
        out=[];
      }
    }else{
      out=me.Roles;
    }
    return out;
  }
/**
 * redmine テーブル取得REST ユーザー
 * @return {Object} ユーザーテーブル
 * @method
 */
  redUser() { // redmine テーブル取得REST ユーザー
    let me=this, out=[];
    if(me.unixStamp(me.PROCOM.time.role)){
      try {
        me.shell('../cli/xaRedmine ls users');
        let o=JSON.parse(me.stdout);
        let x;
        for(let i in o.users) {
          x=o.users[i]; out[i]={};
          out[i]={
            'id': x.id,
            'name': x.custom_fields[0].value,
            'userid': x.login,
            'fullname': x.lastname + x.firstname,
            'email': x.mail
          };
        }
        me.Users=out;
        Fs.writeFileSync('../data/red-user', JSON.stringify(out));
      }catch(e) {
        me.errorLog('write error', e);
        out=[];
      }
    }else{
      out=me.Users;
    }
    return out;
  }
/**
 * Gitlabユーザー登録データ作成
 * @param  {Object} dt 共通ユーザーデータ
 * @return {Object}    作成データ
 * @method
 */
  gitUserAdd(dt) { // Gitlabユーザー登録データ作成
    let out=[];
    for(let i in dt){
      out[i]={};
      out[i].email=dt[i].mail;
      out[i].password=dt[i].password;
      out[i].username=dt[i].mail;
      out[i].name=dt[i].lastname + ' ' + dt[i].firstname;
      out[i].username=dt[i].mail;
      out[i].confirm=false;
    }
  }
/**
 * Gitコマンド発行
 * @param  {Object} op 発行コマンドテーブル(フェーズ別に編集、status,clone,order,merge)
 * @return {Boolean}   true/false
 * @method
 */
  gitCommand(op) { // Gitコマンド発行
    switch(op.command){
    case 'status':
      this.commands([
        'git status'
      ]);
      break;
    case 'clone':
      this.commands([
        'git clone ' + op.repository
      ]);
      break;
    case 'order':
      this.commands([
        'git checkout master',
        'git fetch origin master',
        'git checkout -b ' + op.branch
      ]);
      break;
    case 'merge':
      this.commands([
        'git checkout master',
        'git fetch origin master',
        'git merge ' + op.branch,
        'git push',
        'git branch --delete origin ' + op.branch,
        'git push --delete origin ' + op.branch
      ]);
      break;
    default:
    }
  }
/**
   * 新プロジェクト時の基本トラッカーデータ作成
   * @param  {string} pid プロジェクトID
   * @return {Object}     作成データ
   * @method
   */
  newTracker(pid) { // 新プロジェクト時の基本トラッカーデータ作成
    let me=this, out={}, buf, a=[], f, t;
    try {
      buf=Fs.readFileSync('../template/project.json');
      out=JSON.parse(buf.toString('utf-8'));
    }catch(e) {
      out={'tasks': []};
      me.errorLog('get file error /template/project.json', e);
    }
    let i; a[0]=''; for(i in out.tasks) {
      if(i==0){
        out.tasks[i].id=pid;
        out.tasks[i].name=pid;
      }
      if(out.tasks[i].level==1){
        a=me.dateinit(a[0]);
        out.tasks[i].start=a[1];
        out.tasks[i].end=a[2];
        if(!f){f=a[1];} t=a[2];
      }
      if(out.tasks[i].level>1){
        out.tasks[i].start=out.tasks[i-1].start;
        out.tasks[i].end=out.tasks[i-1].end;
      }
    }
    out.tasks[0].start=f; out.tasks[0].end=t;
    me.redUser();
    out.resources=me.Users;
    me.redRole();
    out.roles=me.Roles;
    return out;
  }
/**
 * ganttチャートデータをredmineデータに変換
 * @param  {Object}  inx ganttチャートデータ
 * @param  {Boolean} inx コマンド発行(true/false)
 * @return {Objecy}      redmineデータ
 * @method
 */
  ganttToRed(inx, command) { // ganttチャートデータをredmineデータに変換
    const me=this; let x, out=[], a, o, r, c, save={};
    let i, j=0; for(i in inx.tasks) {
      x=inx.tasks[i];
      if(x.level==1){save.tracker=x.name; continue;}
      else if(x.level==0){save.project=x.name; continue;}
      o={'status_id': '', 'priority_id': ''};
      if(x.id.substr(0, 4)!='tmp_'){o.id=x.id.substr(1);}
      o.project_id=me.find('project', save.project);
      o.tracker_id=me.find('tracker', save.tracker);
      o.done_ratio=x.progress;
      let t;
      switch(x.status) {
      case 'STATUS_UNDEFINED': o.status_id=me.find('status', '新規(N)'); break;
      case 'STATUS_ORDERED':
        if(x.assigs[0]){t='指示(O)';}else{t='新規(O)';}
        o.status_id=me.find('status', t);
        break;
      case 'STATUS_ACTIVE': o.status_id=me.find('status', '実施(E)'); break;
      case 'STATUS_SUSPENDED': o.status_id=me.find('status', '保留(H)'); break;
      case 'STATUS_FAILED': o.status_id=me.find('status', '中止(Q)'); break;
      case 'STATUS_DONE':
        o.status_id=me.find('status', '精査(P)');
        o.done_ratio=100;
        break;
      case 'STATUS_FINISHED':
        o.status_id=me.find('status', '終了(F)');
        o.done_ratio=80;
        break;
      default: o.status_id=me.find('status', '保留(H)');
      }
      a=x.code.split('/');
      if(a[1]){o.priority_id=me.find('priority', a[1]);}
      else{o.priority_id=me.find('priority', '通常');}
      if(x.description){o.description=x.description;}
      o.subject=x.name;
      o.start_date=me.find('date', x.start);
      o.due_date=me.find('date', x.start);
      o.estimated_hours=x.duration*8;
      if(x.assigs[0]){if(x.assigs[0].resourceId){
        if(x.assigs[0].resourceId.length>5){o.assigned_to_id=x.assigs[0].resourceId.substr(4);}
        else{o.assigned_to_id=x.assigs[0].resourceId;}
      }}
      if(save.level < x.level){if(save.id){o.parent_id=save.id;}}
      o.custom_fields=[];
      o.custom_fields[0]={};
      o.custom_fields[0].name='code';
      o.custom_fields[0].id='4';
      o.custom_fields[0].value=a[0];
      o.custom_fields[1]={};
      o.custom_fields[1].name='gantt';
      o.custom_fields[1].id='3';
      o.custom_fields[1].value=me.base64(JSON.stringify(x), 'encode');
      out[j]=o;
      //console.log('#726', x, o);
      if(command){
        c={issue: o};
        if(o.id){
          r=me.commands(['../cli/xaRedmine put '+o.id+' \''+JSON.stringify(c)+'\'']);
          console.log(r, o);
        }else{
          console.log('#733');
          r=me.commands(['../cli/xaRedmine post issues \''+JSON.stringify(c)+'\'']);
        }
        if(!r){
          return false;
        }
      }
      save.level=x.level;
      j++;
    }
    return out;
  }
/**
 * redmineデータをganttデータに変換
 * @param  {Object} inx redmineデータ
 * @return {Objecy}     ganttチャートデータ
 * @method
 */
  redToGantt(inx) { // redmineデータをganttデータに変換
    let me=this, x, out=[], o, d, n, save={project: '', tracker: ''};
    let levels={}, keys={}, hasChild={};
    if(typeof(inx)=='number'){
      inx=me.redTicket(inx);
    }else if(typeof(inx)=='string'){
      let k=me.find('project', inx); if(k=='error'){return false;}
      inx=me.redTicket(k);
    }
    let i; for(i in inx) {
      x=inx[i];
      if(x.project_id!=save.project){
        o={};
        o.key=me.prezero(x.project_id, 6);
        o.level=0;
        o.id='P'+x.project_id;
        o.name=me.find('projectid', x.project_id);
        o.status='STATUS_ACTIVE';
        o.code=o.id;
        o.start=me.unixTime();
        o.end=me.unixTime();
        o.canWrite=true;
        n=1;
        out.push(o);
      }

      if(x.tracker_id!=save.tracker){
        o={};
        o.key=me.prezero(x.project_id, 6)+me.prezero(x.tracker_id,6);
        o.level=1;
        o.name=x.tracker_name;
        o.id=me.brakets(x.tracker_name);
        o.status='STATUS_ACTIVE';
        o.code=o.id;
        o.start=me.unixTime();
        o.end=me.unixTime();
        o.canWrite=true;
        n=2;
        out.push(o);
      }

      o={};
      if(x.gantt){
        o=JSON.parse(me.base64(x.gantt, 'decode'));
      }
      if(x.parent_id){
        o.level=levels[x.parent_id]+1;
        o.key=keys[x.parent_id];
        hasChild[x.parent_id]=true;
      }else{
        o.level=n;
        o.key=me.prezero(x.project_id, 6)+me.prezero(x.tracker_id,6);
      }
      o.key+=x.start_date+me.prezero(x.id, 6);
      levels[x.id]=o.level;
      keys[x.id]=o.key;
      o.name=x.subject;
      o.id='I'+x.id;
      o.progress=x.done_ratio||0;
      switch(x.status_name) {
      case '新規(N)': o.status='STATUS_UNDEFINED'; o.progress=0; break;
      case '指示(O)': o.status='STATUS_ORDERED'; o.progress=0; break;
      case '実施(E)': o.status='STATUS_ACTIVE'; if(o.progress>79){o.progress=40;} break;
      case '保留(H)': o.status='STATUS_SUSPENDED'; break;
      case '終了(F)': o.status='STATUS_FINISHED'; o.progress=80; break;
      case '精査(P)': o.status='STATUS_DONE'; o.progress=100; break;
      case '中止(Q)': o.status='STATUS_FAILED'; o.progress=0; break;
      default: o.status='STATUS_UNDEFINED';
      }
      o.code=(x.code||'')+'/'+(x.priority_name||'');
      o.description=x.description||'';
      if(x.start_date){
        d=new Date(x.start_date+' 0:00:00');
        o.start=d.getTime();
      }else{
        o.start=me.unixTime();
      }
      if(x.due_date){
        d=new Date(x.due_date+' 0:00:00');
        o.end=d.getTime();
      }else{
        o.end=me.unixTime();
      }
      if(x.estimated_hours){o.duration=Math.ceil(x.estimated_hours/8);}
      if(x.assigned_id){
        o.assigs=[];
        o.assigs[0]={};
        o.assigs[0].resourceId=x.assigned_id;
        o.assigs[0].resourceName=x.assigned_name;
      }
      o.canWrite=true;
      o.type='';
      o.typeid='';
      o.relevance=0;
      out.push(o);
      save.project=x.project_id;
      save.tracker=x.tracker_id;

    }
    out=me.sort(out,['key']);
    for(i in out){
      if(hasChild[out[i].id.substr(1)]){out[i].hasChild=true;}
      else{out[i].hasChild=false;}
      if(out[i].level<2){out[i].hasChild=true;}
      out[i].startIsMilestone=out[i].startIsMilestone||false;
      out[i].endIsMilestone=out[i].endIsMilestone||false;
      out[i].collapsed=out[i].collapsed||false;
      delete out[i].key;
    }
    //console.log('#860', inx, out);
    return out;
  }
/**
 * URLの取得
 * @param  {String} group URLの種別
 * @param  {Array}  keys  種別毎に決められたパラメータ配列
 * @return {String}       結果URL
 * @method
 */
  getUrl(group, keys) {
    let me=this;
    switch(group) {
    case 'ticket':
      return 'http://192.168.1.64/issues/'+me.find('ticketByCode', keys[0], keys[1]);
    default: return 'error';
    }
  }
/**
 * 値検索(redmine)
 * @param  {String} group 値グループ
 * @param  {String} key   値
 * @return {String}       参照値
 * @method
 */
  find(group, key, key2) { // 値検索(redmine)
    let me=this, i, d;
    switch(group) {
    case 'project':
      d=me.redProject();
      for(i in d) {if(d[i].name==key){return d[i].id;}}
      return 'error';
    case 'ticketByCode':
      d=me.redTicket(key2);
      for(i in d) {if(d[i].code==key){return d[i].id;}}
      return 'error';
    case 'projectid':
      d=me.redProject();
      for(i in d) {if(d[i].id==key){return d[i].name;}}
      return 'error';
    case 'tracker':
      d=me.redTracker();
      for(i in d) {if(d[i].name==key){return d[i].id;}}
      return 'error';
    case 'status':
      switch(key){
      case '新規(N)': return 1;
      case '指示(O)': return 2;
      case '実施(E)': return 3;
      case '保留(H)': return 4;
      case '終了(F)': return 5;
      case '精査(P)': return 6;
      case '中止(Q)': return 7;
      }
      return 'error';
    case 'priority':
      switch(key){
      case '優先': return 1;
      case '通常': return 2;
      case '余裕': return 3;
      }
      return 'error';
    case 'statusGtoR':
      switch(key) {
      case 'STATUS_ACTIVE': return 3;
      case 'STATUS_DONE': return 4;
      case 'STATUS_FINISHED': return 5;
      case 'STATUS_FAILED': return 7;
      case 'STATUS_SUSPENDED': return 6;
      case 'STATUS_UNDEFINED': return 1;
      case 'STATUS_ORDERED': return 2;
      }
      return 6;
    case 'date':
      d=new Date(key);
      return d.getFullYear()+'-'+
        ((d.getMonth()+101+' ').substr(1, 2))+'-'+
        ((d.getDate()+100+' ').substr(1, 2));
    }
    return 'group error';
  }
/**
 * OSコマンド発行
 * @param  {Array} cmds コマンド配列
 * @return {Integer}    処理件数
 * @method
 */
  commands(cmds) { // OSコマンド発行
    let rc=0;
    let i; for(i in cmds){
      if(this.shell(cmds[i])){
        console.log(cmds[i]);
        this.infoLog(this.stdout);
        rc++;
      }else{
        this.errorLog('shell command error =' + cmds[i], this.error);
        return rc;
      }
    }
    return rc;
  }
/**
 * コンテキストタイプ編集
 * @param  {String} mdf ファイル拡張子 html, json ...
 * @return {String}    コンテキストタイプ text/html, application.json ...
 * @method
 */
  ctype(mdf) { // コンテキストタイプ編集
    let out;
    out={
      'html': 'text/html', 'css': 'text/css', 'js': 'text/javascript', 'txt': 'text/plane',
      'xml': 'text/xml',
      'png': 'image/png', 'gif': 'image/gif', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
      'ico': 'image/x-icon'
    }[mdf]||'plain/text';
    return out;
  }
/**
 * メール送信
 * @param  {Object} data 送信データ
 * @param  {Object} op   送信オプション
 * @return {String}      送信結果|false
 * @method
 */
  sendMail(op, setting) { // メール送信
    const me=this;
    let wid=me.ready();
    const smtp=Ml.createTransport('SMTP', setting);
    smtp.sendMail(op, function(err, res){
      if(err){me.error=err; me.post(wid, false);}
      else{me.post(wid, res.message);}
    });
    return me.wait();
  }
/**
 * 前にゼロづめする
 * @param  {Integer} x 入力数
 * @param  {Integer} n 出力桁数
 * @return {String}    結果文字列
 * @method
 */
  prezero(x, n) {
    let o='0000000000'+x;
    return o.substr(o.length-n, n);
  }
/**
 * 月初、月末unixdate設定
 * @param  {Object} d  日付オブジェクト、''の時当月
 * @param  {Integer} n 月初日への経過月数、省略時（+1：翌月）
 * @param  {Integer} m 月末日への経過月数、省略時(0:月初日と同じ月)
 * @return {Array}     [計算後オブジェクト,月初unixdate,月末unixdate]
 * @method
 */
  dateinit(b, n, m) {
    let out=[], d, t;
    if(b){d=b;}else{d=new Date();} n=n||1; m=m||0;
    t=d.getMonth()+n;
    d.setMonth(t); if(t==10){d.setMonth(10);}
    d.setDate(1);
    out[1]=Date.parse(d);
    d.setMonth(d.getMonth() + m+1);
    d.setDate(1);
    d.setDate(d.getDate() -1);
    out[2]=Date.parse(d);
    out[0]=d;
    return out;
  }
};
