import { Types } from 'mongoose';

export const dailyPerformenceAgg = (
  userId: string,
  dateTime: string,
  page: Number,
  limit: Number,
) => {
  const todaysDate = new Date(dateTime);
  console.log(`${page} - ${limit}`);
  //   //   const todaysDate = new Date();
  //   const thirtyDaysAgo = todaysDate.setDate(todaysDate.getDate() - 30);
  //   const thirtyDaysAgoDate = new Date(thirtyDaysAgo).toISOString();
  //   console.log(todaysDate);
  return [
    {
      $match: {
        user: { $eq: new Types.ObjectId(userId) },
        date: { $eq: todaysDate },
      },
    },
    {
      $sort: { _id: -1 },
    },
    {
      $project: {
        _id: 0,
        issueSummary: 1,
        issueType: 1,
        linkedId: '$link',
        issueStatus: 1,
        issueIdUrl: 1,
        issueLinkUrl: 1,
        planned: 1,
      },
    },

    {
      $facet: {
        total: [{ $count: 'total' }],
        data: [
          { $skip: (Number(page) - 1) * Number(limit) || 0 },
          { $limit: Number(limit) },
        ],
      },
    },
    {
      $unwind: '$total',
    },
    {
      $project: {
        count: '$total.total',
        data: 1,
      },
    },
  ];
};
