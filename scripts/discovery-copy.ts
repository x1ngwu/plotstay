import type { HomeConfig } from '@plotstay/contracts';

// User-approved on 2026-10-07. Text only; destinations and configuration stay unchanged.
// See docs/phase-3-visual-alignment.md for the reviewed bilingual copy.
type Copy = Pick<HomeConfig['translations'][string], 'eyebrow' | 'title' | 'intro' | 'promotion' | 'benefits'>;
export const discoveryCopy: Record<string, Copy> = {
  en: {
    eyebrow: 'LATHE WORLDS TRAVEL',
    title: 'Your next leave starts here.',
    intro: 'Find a room, join a forge tour, and arrange local services for your stay.',
    promotion: {
      audience: 'FOR TRAVELLERS WITH AUGMETICS',
      title: 'No extra-bed fee for accompanying mechanical limbs.',
      body: 'Find a place for you and your accompanying parts. Please declare any parts that require separate charging before arrival.',
      button: 'Explore travel options',
    },
    benefits: [
      { title: 'Make more of your stay', body: 'Pair a room with a local tour. Plan them together; leave approvals must still be requested separately.', button: 'Plan your trip' },
      { title: 'From orbital docks to the forge', body: 'Explore homes, experiences and local services by district. Quiet rooms are assessed against local production standards.', button: 'Explore the area' },
      { title: 'A little extra for returning travellers', body: 'Your loyalty deserves recognition. Leave requests remain your responsibility.', button: 'About our travel service' },
    ],
  },
  'zh-CN': {
    eyebrow: '拉斯世界旅行服务',
    title: '下一次休假，从这里开始。',
    intro: '从观景客房到铸造厂导览，安排住宿、当地体验与旅途所需服务。',
    promotion: {
      audience: '携带机械部件的旅客适用',
      title: '随行机械肢体，免收加床费。',
      body: '为您与随行部件安排一处落脚点。请在入住前申报需单独充电的部件。',
      button: '查看旅行选择',
    },
    benefits: [
      { title: '住宿与体验组合礼遇', body: '住进观景客房，再参加当地导览。行程一并安排，休假批准仍请分开申请。', button: '安排行程' },
      { title: '从轨道码头到铸造厂', body: '按地区探索客房、活动与当地服务。静修客房的“安静”以当地生产标准为准。', button: '探索当地' },
      { title: '常旅客特别礼遇', body: '您的忠诚值得记录。休假申请仍需自行递交。', button: '了解旅行服务' },
    ],
  },
};
