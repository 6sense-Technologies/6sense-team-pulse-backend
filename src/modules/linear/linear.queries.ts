export const LINEAR_ISSUE_QUERY = `
  query GetTasksByDate($dueDate: TimelessDateOrDuration, $email: String) {
    organization {
      urlKey
    }
    issues(
      filter: {
        dueDate: { eq: $dueDate }
        assignee: { email: { eq: $email } }
      }
    ) 
    {
      nodes {
        id
        title
        dueDate
        completedAt
        url
        identifier
        state {
          type
        }
        labels{
          nodes{
            id
            name
          }
        }
        assignee {
          id
          name
          timezone
        }
        createdAt
        updatedAt
        parent {
          identifier
        }
        relations{
          nodes{
            issue{
              identifier
            }
          }
        }
        children{
          nodes{
            identifier
          }
        }
      }
    }
  }
`;
