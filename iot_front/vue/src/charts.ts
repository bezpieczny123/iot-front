import { BarElement, CategoryScale, Chart, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'

// vue-chartjs registers the controllers for its typed Line and Bar components.
Chart.register(BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

export function chartTheme() {
  const styles = getComputedStyle(document.documentElement)
  return {
    accent: styles.getPropertyValue('--ac').trim(),
    grid: styles.getPropertyValue('--ln').trim(),
    muted: styles.getPropertyValue('--mu').trim(),
    font: { family: styles.getPropertyValue('--mono').trim(), size: 11 },
  }
}
