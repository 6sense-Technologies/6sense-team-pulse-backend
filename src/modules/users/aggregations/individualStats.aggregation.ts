import mongoose, { Types } from 'mongoose';

export const individualStats = (
  userId: string,
  page: Number,
  limit: Number,
) => {
  const doneCondition = [
    'Done',
    'In Review',
    'USER STORIES (Verified In Beta)',
    'USER STORIES (Verified In Test)',
  ];
  const indiestatAgg = [
    {
      $match: {
        user: new Types.ObjectId(userId),
        issueType: {
          $in: ['Task', 'Story', 'Bug'],
        },
      },
    },
    {
      $sort: { date: -1 }, // Sort by date in ascending order
    },
    {
      $group: {
        _id: '$date',
        insight: { $first: '$comment' },
        // Group by the 'date' field
        doneTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $in: ['$issueStatus', doneCondition],
                  },
                  {
                    $eq: ['$planned', true],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        doneTaskCountUnplanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $in: ['$issueStatus', doneCondition],
                  },
                  {
                    $eq: ['$planned', false],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $not: {
                      $in: ['$issueStatus', doneCondition],
                    },
                  },
                  {
                    $eq: ['$planned', true],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneTaskCountUnplanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $not: {
                      $in: ['$issueStatus', doneCondition],
                    },
                  },
                  {
                    $eq: ['$planned', false],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        doneStoryCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Story'],
                  },
                  {
                    $in: ['$issueStatus',doneCondition],
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneStoryCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Story'],
                  },
                  {
                    $not: {
                      $in: ['$issueStatus',doneCondition],
                    },
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
        doneBugCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Bug'],
                  },
                  {
                    $in: ['$issueStatus', doneCondition],
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneBugCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Bug'],
                  },
                  {
                    $not: {
                      $in: ['$issueStatus', doneCondition],
                    },
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: { _id: -1 },
    },
    {
      $addFields: {
        totalTaskCount: {
          $sum: [
            '$doneTaskCountPlanned',
            '$doneTaskCountUnplanned',
            '$notDoneTaskCountPlanned',
            '$notDoneTaskCountUnplanned',
          ],
        },
        totalTaskPlanned: {
          $sum: ['$doneTaskCountPlanned', '$notDoneTaskCountPlanned'],
        },
        totalTaskUnPlanned: {
          $sum: ['$doneTaskCountUnplanned', '$notDoneTaskCountUnplanned'],
        },
        totalDoneTaskCount: {
          $sum: ['$doneTaskCountPlanned', '$doneTaskCountUnPlanned'],
        },
        totalStoryCount: {
          $sum: ['$doneStoryCount', '$notDoneStoryCount'],
        },
        totalBugCount: {
          $sum: ['$doneBugCount', '$notDoneBugCount'],
        },
      },
    },
    {
      $addFields: {
        taskCompletionRate: {
          $cond: [
            {
              $eq: ['$totalTaskCount', 0],
            },
            1,
            {
              $multiply: [
                {
                  $divide: ['$totalDoneTaskCount', '$totalTaskCount'],
                },
                100,
              ],
            },
          ],
        },
        storyCompletionRate: {
          $cond: [
            {
              $eq: ['$totalStoryCount', 0],
            },
            0,
            {
              $multiply: [
                {
                  $divide: ['$doneStoryCount', '$totalStoryCount'],
                },
                100,
              ],
            },
          ],
        },
        codeToBugRatio: {
          $cond: [
            {
              $eq: ['$totalTaskCount', 0],
            },
            0,
            {
              $multiply: [
                {
                  $divide: ['$totalBugCount', '$totalTaskCount'],
                },
                1,
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        score: {
          $multiply: [
            {
              $divide: [
                {
                  $add: [
                    {
                      $multiply: ['$taskCompletionRate', 1],
                    },
                    {
                      $multiply: ['$storyCompletionRate', 2],
                    },
                  ],
                },
                300,
              ],
            },
            100,
          ],
        },
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
  return indiestatAgg;
};
