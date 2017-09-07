'use strict';
const keUtility=require('ke-utility');
module.exports=class keChatwork extends keUtility {
/**
 * チャットワークインターフェイス
 * @param  {String} token 認証トークン
 * @return {Void}         none
 * @constructor
 */
  constructor(token) {
    super();
    this.Option={};
    this.Option.headers={
      'X-ChatWorkToken': token,
      'Content-Type': 'application/json'
    };
    this.Option.hostname='api.chatwork.com';
  }
/**
 * ルームリストの取得
 * @return {Object} ルーム名、IDオブジェクト
 * @method
 */
  getRooms() {
    if(!this.Option.headers['X-ChatwworkToken']) {
      this.Option.headers['X-ChatwworkToken']=this.CFG.chatworkKey;
    }
    let op=this.Option, rc;
    op.path='/v2/rooms';
    rc=this.getRequest(op, true, true);
    this.Rooms={};
    for(let i in rc){
      this.Rooms[rc[i].name]=rc[i].room_id;
    }
    return this.Rooms;
  }
/**
 * ルームボードにメッセージ送信
 * @param  {String} msg  送信メッセージ
 * @param  {String} room ルーム名
 * @return {Bool}        true/false OK/NG
 * @method
 */
  pushMessage(msg, room) {
    let op=this.Option, rc;
    if(!this.Rooms){this.getRooms();}
    let rid = this.Rooms[room];
    if(rid){
      op.path='/v2/rooms/'+rid+'/messages?body='+msg;
      rc=this.postRequest(op, {}, true);
      if(rc){return true;}else{return false;}
    }else{
      this.error='room('+room+') can not be found !!';
      return false;
    }
  }
};
