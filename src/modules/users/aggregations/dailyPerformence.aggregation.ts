import { Types } from 'mongoose';

export const dailyPerformenceAgg = (
  userId: string,
  page: Number,
  limit: Number,
) => {
  const todaysDate = new Date();
  //   //   const todaysDate = new Date();
  //   const thirtyDaysAgo = todaysDate.setDate(todaysDate.getDate() - 30);
  //   const thirtyDaysAgoDate = new Date(thirtyDaysAgo).toISOString();
  //   console.log(todaysDate);
  return [
    {
      $match: {
        user: { $eq: new Types.ObjectId(userId) },
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
      },
    },
    {
      $facet: {
        total: [{ $count: 'total' }],
        data: [
          { $skip: (Number(page) - 1) * Number(limit) },
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
