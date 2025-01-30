import mongoose from 'mongoose';

export const individualStats = (userId: string, page: Number, limit: Number) => {
  return [
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId), ///aka user
        issueType: { $in: ['Task', 'Story', 'Bug'] },
      },
    },
    {
      $group: {
        _id: '$date', // Group by the 'date' field
        doneTaskCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $in: ['$issueStatus', ['Done', 'In Review']],
                  },
                  { $eq: ['$planned', true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneTaskCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $not: { $in: ['$issueStatus', ['Done', 'In Review']] },
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
                  { $eq: ['$issueType', 'Story'] },
                  {
                    $in: [
                      '$issueStatus',
                      [
                        'Done',
                        'USER STORIES (Verified In Test)',
                        'USER STORIES (Verified In Beta)',
                      ],
                    ],
                  },
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
                  { $eq: ['$issueType', 'Story'] },
                  {
                    $not: {
                      $in: [
                        '$issueStatus',
                        [
                          'Done',
                          'USER STORIES (Verified In Test)',
                          'USER STORIES (Verified In Beta)',
                        ],
                      ],
                    },
                  },
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
                  { $eq: ['$issueType', 'Bug'] },
                  { $eq: ['$issueStatus', 'Done'] },
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
                  { $eq: ['$issueType', 'Bug'] },
                  { $ne: ['$issueStatus', 'Done'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        doneTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $in: ['$issueStatus', ['Done', 'In Review']],
                  },
                  { $eq: ['$planned', true] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  { $eq: ['$planned', true] },
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
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $in: ['$issueStatus', ['Done', 'In Review']],
                  },
                  {
                    $eq: ['planned', false],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalTaskCountUnPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $not: { $in: ['$issueStatus', ['Done', 'In Review']] },
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalBugs: {
          $sum: {
            $cond: [
              {
                $and: [{ $eq: ['$issueType', 'Bug'] }],
              },
              1,
              0,
            ],
          },
        },
        totalStories: {
          $sum: {
            $cond: [
              {
                $and: [{ $eq: ['$issueType', 'Story'] }],
              },
              1,
              0,
            ],
          },
        },
        comment: { $first: '$comment' }, //getting the first one from each group
      },
    },
    {
      $project: {
        date: '$_id', // Rename _id to date
        doneTaskCount: 1,
        notDoneTaskCount: 1,
        doneStoryCount: 1,
        notDoneStoryCount: 1,
        doneBugCount: 1,
        notDoneBugCount: 1,
        doneTaskCountPlanned: 1,
        totalTaskCountPlanned: 1,
        doneTaskCountUnplanned: 1,
        totalTaskCountUnPlanned: 1,
        totalBugs: 1,
        totalStories: 1,
        comment: 1, // Include the first comment
        user: 1,
        // Calculate ratios
        taskRatio: {
          $cond: {
            if: {
              $eq: [{ $add: ['$totalTaskCountPlanned'] }, 0],
            }, // If the total count is 0, set ratio to null
            then: 0,
            else: {
              $divide: ['$doneTaskCount', { $add: ['$totalTaskCountPlanned'] }],
            }, // done / (done + not done)
          },
        },
        storyRatio: {
          $cond: {
            if: {
              $eq: [{ $add: ['$doneStoryCount', '$notDoneStoryCount'] }, 0],
            },
            then: 0,
            else: {
              $divide: [
                '$doneStoryCount',
                { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
              ],
            },
          },
        },
        bugRatio: {
          $cond: {
            if: {
              $eq: [{ $add: ['$doneBugCount', '$notDoneBugCount'] }, 0],
            },
            then: 0,
            else: {
              $divide: [
                '$doneBugCount',
                { $add: ['$doneBugCount', '$notDoneBugCount'] },
              ],
            },
          },
        },
        score: {
          // $divide: [{ $add: ['$taskRatio', '$storyRatio'] },],
          $divide: [
            {
              $add: [
                {
                  $cond: {
                    if: {
                      $eq: [
                        { $add: ['$doneTaskCount', '$notDoneTaskCount'] },
                        0,
                      ],
                    },
                    then: 0,
                    else: {
                      $divide: [
                        '$doneTaskCount',
                        { $add: ['$doneTaskCount', '$notDoneTaskCount'] },
                      ],
                    },
                  },
                },
                {
                  $cond: {
                    if: {
                      $eq: [
                        { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
                        0,
                      ],
                    },
                    then: 0,
                    else: {
                      $divide: [
                        '$doneStoryCount',
                        { $add: ['$doneStoryCount', '$notDoneStoryCount'] },
                      ],
                    },
                  },
                },
              ],
            },
            2,
          ],
        },
        _id: 0, // Remove the _id field
      },
    },
    {
      $sort: { date: 1 }, // Sort by date in ascending order
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
