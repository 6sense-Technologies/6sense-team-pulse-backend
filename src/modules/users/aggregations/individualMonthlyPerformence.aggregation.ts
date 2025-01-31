import mongoose, { Types } from 'mongoose';

export const monthlyStat = (userId: string, date: string) => {
  const doneCondition = [
    'Done',
    'In Review',
    'USER STORIES (Verified In Beta)',
    'USER STORIES (Verified In Test)',
  ];
  const monthlyStatAgg = [
    {
      $match: {
        user: new Types.ObjectId(userId),
        issueType: {
          $in: ['Task', 'Story', 'Bug'],
        },
        date: {
          $gte: new Date(date),
        },
      },
    },
    {
      $sort: { date: -1 }, // Sort by date in ascending order
    },
    {
      $group: {
        _id: {
          user: '$user',
          date: '$date',
        },
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
      },
    },
    {
      $sort: { _id: -1 }, // Re-sort grouped data by date descending
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
        totalDoneTaskCount: {
          $sum: ['$doneTaskCountPlanned', '$doneTaskCountUnplanned'],
        },
        totalNotDoneTaskCount: {
          $sum: ['$notDoneTaskCountPlanned', '$notDoneTaskCountUnplanned'],
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
                1,
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
                1,
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
                3,
              ],
            },
            100,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        averageScore: { $avg: '$score' },
      },
    },
    {
      $addFields: {
        averageScore: '$averageScore',
      },
    },
  ];
  return monthlyStatAgg;
};
