import minimal from './minimal.mjs';

// 在最小策略之上加入免費行動：領取福利、有錢就還貸款。
export default {
  ...minimal,
  id: 'basic',
  name: '基礎',
  description: '最小合法策略，另外會領取國家福利並在有餘裕時償還貸款。',
  free(ctx) {
    return [{ type: 'benefits' }, { type: 'repay' }];
  },
};
