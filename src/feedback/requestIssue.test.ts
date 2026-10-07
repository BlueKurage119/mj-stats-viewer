import {describe,it,expect} from 'vitest';
import {ApiError,MaintenanceError} from '../api';
import {toRequestIssue} from './requestIssue';
describe('request issue classification',()=>{
  it('classifies maintenance without disclosing the server message',()=>expect(toRequestIssue(new MaintenanceError('secret'))).toEqual({kind:'maintenance',message:'サーバーがメンテナンス中です。しばらくしてからお試しください。'}));
  it('classifies exhausted mirrors as network',()=>expect(toRequestIssue(new ApiError('secret',0,'private'))).toEqual({kind:'network',message:'データを取得できませんでした。接続を確認して、もう一度お試しください。'}));
  it('keeps HTTP status for diagnostics only',()=>expect(toRequestIssue(new ApiError('secret',500,'private'))).toEqual({kind:'http',status:500,message:'データを取得できませんでした。'}));
  it('does not disclose arbitrary exception text',()=>expect(toRequestIssue(new Error('secret'))).toEqual({kind:'unknown',message:'データを取得できませんでした。'}));
});
