# Formulas for Individual Stats
# Daily Score:
## 1. Total Task Count
$$
\text{TotalTaskCount} = \text{DoneTaskCountPlanned} + \text{DoneTaskCountUnplanned} + \text{NotDoneTaskCountPlanned} + \text{NotDoneTaskCountUnplanned}
$$

## 2. Total Planned Tasks
$$
\text{TotalTaskPlanned} = \text{DoneTaskCountPlanned} + \text{NotDoneTaskCountPlanned}
$$

## 3. Total Unplanned Tasks
$$
\text{TotalTaskUnPlanned} = \text{DoneTaskCountUnplanned} + \text{NotDoneTaskCountUnplanned}
$$

## 4. Total Done Tasks
$$
\text{TotalDoneTaskCount} = \text{DoneTaskCountPlanned} + \text{DoneTaskCountUnplanned}
$$

## 5. Total Story Count
$$
\text{TotalStoryCount} = \text{DoneStoryCount} + \text{NotDoneStoryCount}
$$

## 6. Total Bug Count
$$
\text{TotalBugCount} = \text{DoneBugCount} + \text{NotDoneBugCount}
$$

## 7. Task Completion Rate (%)
$$
\text{TaskCompletionRate} =
\begin{cases}
1, & \text{if } \text{TotalTaskCount} = 0 \\
\left( \frac{\text{TotalDoneTaskCount}}{\text{TotalTaskCount}} \right) \times 100, & \text{otherwise}
\end{cases}
$$

## 8. Story Completion Rate (%)
$$
\text{StoryCompletionRate} =
\begin{cases}
0, & \text{if } \text{TotalStoryCount} = 0 \\
\left( \frac{\text{DoneStoryCount}}{\text{TotalStoryCount}} \right) \times 100, & \text{otherwise}
\end{cases}
$$

## 9. Code-to-Bug Ratio
$$
\text{CodeToBugRatio} =
\begin{cases}
0, & \text{if } \text{TotalTaskCount} = 0 \\
\frac{\text{TotalBugCount}}{\text{TotalTaskCount}}, & \text{otherwise}
\end{cases}
$$

## 10. Score Calculation
$$
\text{Score} =
\left( \frac{ \left( \text{TaskCompletionRate} \times 1 \right) + \left( \text{StoryCompletionRate} \times 2 \right) }{300} \right) \times 100
$$

# Overview


## Performance
To calculate the **Performance for a user** over multiple days, we take the sum of the daily scores and divide it by the total number of days excluding vacation for a user:

$$
\text{AverageScore} = \frac{\sum \text{DailyScore}}{\text{TotalDays}}
$$

Alternatively, expanding the **Daily Score Formula**:

$$
\text{AverageScore} =
\frac{ \sum \left( \frac{ \left( \text{TaskCompletionRate} \times 1 \right) + \left( \text{StoryCompletionRate} \times 2 \right) }{300} \times 100 \right) }{\text{TotalDays}}
$$


This formula provides the **overall performance trend** over a given period.