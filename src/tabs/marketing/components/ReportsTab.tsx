/**
 * Reports tab — renders the operator-grade Reporting Dashboard.
 * All reporting is tenant-scoped and backed by /api/reporting/* and existing reports/send-worker endpoints.
 */
import React from 'react'
import ReportingDashboard from './ReportingDashboard'

const ReportsTab: React.FC = () => {
  return <ReportingDashboard />
}

export default ReportsTab
