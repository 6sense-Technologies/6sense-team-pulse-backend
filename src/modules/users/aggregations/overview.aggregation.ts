export const overView = (date: string, page: Number, limit: Number) => {
  const doneCondition = [
    'Done',
    'In Review',
    'USER STORIES (Verified In Beta)',
    'USER STORIES (Verified In Test)',
  ];
  
  return [
    {
      $match: {
        comment: { $ne: 'holidays/leave' },
        date: { $gte: new Date(date) },
      },
    },
    {
      $group: {
        _id: { user: '$user', date: '$date' },
        doneTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $in: ['$issueStatus', doneCondition],
                  },
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
                    $in: ['$issueStatus', doneCondition],
                  },
                  { $eq: ['$planned', false] },
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
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $not: {
                      $in: ['$issueStatus', doneCondition],
                    },
                  },
                  { $eq: ['$planned', true] },
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
                  { $eq: ['$issueType', 'Task'] },
                  {
                    $not: {
                      $in: ['$issueStatus', doneCondition],
                    },
                  },
                  { $eq: ['$planned', false] },
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
                    $in: ['$issueStatus', doneCondition],
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
                      $in: ['$issueStatus', doneCondition],
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
                  {
                    $in: ['$issueStatus', doneCondition],
                  },
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
                  {
                    $not: {
                      $in: ['$issueStatus', doneCondition],
                    },
                  },
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
        totalStoryCount: { $sum: ['$doneStoryCount', '$notDoneStoryCount'] },
        totalBugCount: { $sum: ['$doneBugCount', '$notDoneBugCount'] },
      },
    },
    {
      $addFields: {
        taskCompletionRate: {
          $cond: [
            { $eq: ['$totalTaskCount', 0] },
            1,
            { $divide: ['$totalDoneTaskCount', '$totalTaskCount'] },
          ],
        },
        storyCompletionRate: {
          $cond: [
            { $eq: ['$totalStoryCount', 0] },
            0,
            { $divide: ['$doneStoryCount', '$totalStoryCount'] },
          ],
        },
        codeToBugRatio: {
          $cond: [
            { $eq: ['$totalTaskCount', 0] },
            0,
            { $divide: ['$totalBugCount', '$totalTaskCount'] },
          ],
        },
      },
    },
    {
      $addFields: {
        performance: {
          $multiply: [
            {
              $divide: [
                {
                  $add: [
                    { $multiply: ['$taskCompletionRate', 1] },
                    { $multiply: ['$storyCompletionRate', 2] },
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
        _id: '$_id.user',
        performance: { $avg: '$performance' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userData',
      },
    },
    {
      $unwind: '$userData',
    },
    {
      $project: {
        displayName: '$userData.displayName',
        emailAddress: '$userData.emailAddress',
        designation: '$userData.designation',
        avatarUrls: '$userData.avatarUrls',
        role: 'Member',
        performance: 1,
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
