export function isSameLocalDay(left, right) {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

export function getWeekStartDate(inputDate) {
    const date = new Date(inputDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - date.getDay());
    return date;
}

export function getDateKey(inputDate) {
    const date = new Date(inputDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatWeekRange(weekStartDate) {
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startText = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endText = weekStart.getMonth() === weekEnd.getMonth()
        ? weekEnd.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })
        : weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `${startText} - ${endText}`;
}

export function formatDateInputFromDate(date) {
    return getDateKey(date);
}
