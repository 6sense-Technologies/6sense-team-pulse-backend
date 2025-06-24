export const pagination = (page: Number, limit: Number) => {
  return [
    {
      $facet: {
        total: [{ $count: 'total' }],
        data: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }],
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
