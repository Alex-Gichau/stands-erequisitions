import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Mail, 
  Search, 
  Download, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  FileText, 
  Database, 
  KeyRound, 
  Megaphone, 
  Bell, 
  ExternalLink, 
  Copy, 
  Check, 
  Eye, 
  X, 
  Filter, 
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Server,
  Users,
  UserCheck
} from 'lucide-react';
import { EmailAuditLog, SystemLog } from '../types';
import { cn } from '../lib/utils';
import { useRequisitions } from '../contexts/RequisitionContext';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface EmailHistoryAuditPanelProps {
  systemLogs?: SystemLog[];
}

export const EmailHistoryAuditPanel: React.FC<EmailHistoryAuditPanelProps> = ({ systemLogs = [] }) => {
  const { triggerToast, currentUser } = useRequisitions();
  const [serverEmailLogs, setServerEmailLogs] = useState<EmailAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedLog, setSelectedLog] = useState<EmailAuditLog | null>(null);
  const [showTestEmailModal, setShowTestEmailModal] = useState<boolean>(false);
  const [testRecipient, setTestRecipient] = useState<string>(currentUser?.email || 'ict.team@pceastandrews.org');
  const [testSubject, setTestSubject] = useState<string>('STANDS System Audit Diagnostic Check');
  const [testType, setTestType] = useState<string>('DIAGNOSTIC_VERIFICATION');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [graphTimeframe, setGraphTimeframe] = useState<'12H' | '24H' | '1D' | '1M' | '1Y'>('24H');
  const [graphViewMode, setGraphViewMode] = useState<'STATUS' | 'CATEGORY'>('STATUS');

  const itemsPerPage = 15;

  // Fetch backend email logs
  const fetchEmailLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/email-audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (data?.logs) {
          setServerEmailLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn('[EmailAuditPanel] Failed to fetch server email logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmailLogs();
  }, [fetchEmailLogs]);

  // Merge server email logs with client-side reactive systemLogs
  const allMergedLogs = useMemo(() => {
    const mergedMap = new Map<string, EmailAuditLog>();

    // 1. Add server logs
    for (const log of serverEmailLogs) {
      const key = `${log.timestamp}-${log.recipientEmail}-${log.action}`;
      mergedMap.set(log.id || key, log);
    }

    // 2. Extract email events from reactive systemLogs
    for (const sLog of systemLogs) {
      const actionUpper = String(sLog.action || '').toUpperCase();
      const detailsStr = String(sLog.details || '');
      const detailsLower = detailsStr.toLowerCase();

      const isEmailEvent = 
        actionUpper.includes('EMAIL') || 
        actionUpper.includes('MAIL') || 
        actionUpper.includes('PASSWORD_RESET') || 
        actionUpper.includes('AUTOSEND_BACKUP') ||
        detailsLower.includes('email') ||
        detailsLower.includes('mail to') ||
        detailsLower.includes('backup snapshot') ||
        detailsLower.includes('password reset email');

      if (isEmailEvent) {
        let category: EmailAuditLog['category'] = 'REQUISITION_WORKFLOW';
        if (actionUpper.includes('BACKUP') || detailsLower.includes('backup')) {
          category = 'BACKUP_SNAPSHOT';
        } else if (actionUpper.includes('PASSWORD_RESET') || detailsLower.includes('password reset')) {
          category = 'PASSWORD_RESET';
        } else if (actionUpper.includes('BULK') || detailsLower.includes('bulk email')) {
          category = 'BULK_ANNOUNCEMENT';
        } else if (actionUpper.includes('SUMMARY') || detailsLower.includes('digest')) {
          category = 'DIGEST_SUMMARY';
        } else if (actionUpper.includes('ALERT') || detailsLower.includes('alert')) {
          category = 'SYSTEM_ALERT';
        }

        let status: EmailAuditLog['status'] = 'DELIVERED';
        if (actionUpper.includes('SIMULATED') || detailsLower.includes('simulated') || detailsLower.includes('simulated_local_store')) {
          status = 'SIMULATED';
        } else if (actionUpper.includes('SKIPPED') || detailsLower.includes('skipped') || detailsLower.includes('disabled_in_config')) {
          status = 'SKIPPED';
        } else if (actionUpper.includes('FAILED') || detailsLower.includes('failed') || detailsLower.includes('error')) {
          status = 'FAILED';
        }

        let recipientEmail = sLog.metadata?.recipientEmail || sLog.metadata?.email || '';
        if (!recipientEmail) {
          const match = detailsStr.match(/<([^>]+@[^>]+)>/) || detailsStr.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) || detailsStr.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (match) recipientEmail = match[1] || match[0];
        }

        const id = sLog.id || `syslog-email-${sLog.timestamp}`;
        const key = `${sLog.timestamp}-${recipientEmail}-${sLog.action}`;

        if (!mergedMap.has(id) && !mergedMap.has(key)) {
          mergedMap.set(id, {
            id,
            timestamp: sLog.timestamp,
            action: sLog.action,
            category,
            recipientEmail: recipientEmail || 'ict.team@pceastandrews.org',
            recipientName: sLog.metadata?.recipientName || sLog.metadata?.requesterName || (recipientEmail ? recipientEmail.split('@')[0] : 'System Recipient'),
            ccList: sLog.metadata?.notificationEmails || sLog.metadata?.ccList || [],
            subject: sLog.metadata?.requisitionTitle || sLog.metadata?.subject || detailsStr,
            requisitionId: sLog.metadata?.requisitionId,
            requisitionTitle: sLog.metadata?.requisitionTitle,
            amount: sLog.metadata?.amount,
            status,
            performedBy: sLog.performedBy || 'SYSTEM_MAILER',
            details: detailsStr,
            metadata: sLog.metadata
          });
        }
      }
    }

    const list = Array.from(mergedMap.values());
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  }, [serverEmailLogs, systemLogs]);

  // Statistics
  const stats = useMemo(() => {
    const total = allMergedLogs.length;
    const delivered = allMergedLogs.filter(l => l.status === 'DELIVERED').length;
    const simulated = allMergedLogs.filter(l => l.status === 'SIMULATED').length;
    const skipped = allMergedLogs.filter(l => l.status === 'SKIPPED').length;
    const failed = allMergedLogs.filter(l => l.status === 'FAILED').length;

    const requisitionEmails = allMergedLogs.filter(l => l.category === 'REQUISITION_WORKFLOW').length;
    const backupEmails = allMergedLogs.filter(l => l.category === 'BACKUP_SNAPSHOT').length;
    const securityEmails = allMergedLogs.filter(l => l.category === 'PASSWORD_RESET').length;
    const otherEmails = total - (requisitionEmails + backupEmails + securityEmails);

    const successRate = total > 0 ? Math.round(((delivered + simulated) / total) * 100) : 100;

    // Calculate unique users receiving emails across all merged logs
    const uniqueRecipientEmails = new Set(
      allMergedLogs
        .map(l => (l.recipientEmail || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const uniqueUsersCount = uniqueRecipientEmails.size;

    return {
      total,
      delivered,
      simulated,
      skipped,
      failed,
      requisitionEmails,
      backupEmails,
      securityEmails,
      otherEmails,
      successRate,
      uniqueUsersCount
    };
  }, [allMergedLogs]);

  // Aggregate and calculate chart data based on selected timeframe and grouping mode
  const chartData = useMemo(() => {
    const now = new Date();
    const dataPoints: {
      label: string;
      total: number;
      success: number;
      failed: number;
      skipped: number;
      requisitions: number;
      backups: number;
      security: number;
      others: number;
      recipientsCount: number;
    }[] = [];

    // If there are no merged email logs, generate real-looking mock trends so the user is greeted with a highly professional chart visual right away
    const isMock = allMergedLogs.length === 0;

    if (isMock) {
      if (graphTimeframe === '12H') {
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hourLabel = d.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          const idx = 11 - i;
          
          const total = idx % 4 === 0 ? 3 : (idx % 3 === 0 ? 1 : 2);
          const success = total - (idx % 6 === 0 ? 1 : 0);
          const failed = total - success;
          const recipientsCount = Math.max(1, Math.ceil(total * 0.8));
          
          dataPoints.push({
            label: hourLabel,
            total,
            success,
            failed,
            skipped: 0,
            requisitions: success > 0 ? Math.ceil(success * 0.7) : 0,
            backups: idx % 3 === 0 ? 1 : 0,
            security: idx % 5 === 0 ? 1 : 0,
            others: 0,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '24H') {
        for (let i = 23; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hourLabel = d.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          const idx = 23 - i;
          
          const total = idx % 5 === 0 ? 4 : (idx % 3 === 0 ? 2 : 1);
          const success = total - (idx % 8 === 0 ? 1 : 0);
          const failed = total - success;
          const recipientsCount = Math.max(1, Math.ceil(total * 0.75));

          dataPoints.push({
            label: hourLabel,
            total,
            success,
            failed,
            skipped: 0,
            requisitions: success > 0 ? Math.ceil(success * 0.7) : 0,
            backups: idx % 4 === 0 ? 1 : 0,
            security: idx % 6 === 0 ? 1 : 0,
            others: 0,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '1D') {
        // 1 Day: Split into 3-hour blocks (8 blocks total)
        for (let i = 7; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
          const blockStart = new Date(d.getTime() - 3 * 60 * 60 * 1000);
          const startLabel = blockStart.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          const endLabel = d.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          const idx = 7 - i;

          const total = 5 + (idx * 3) % 7;
          const success = total - (idx % 5 === 0 ? 1 : 0);
          const failed = total - success;
          const recipientsCount = Math.max(1, Math.ceil(total * 0.8));

          dataPoints.push({
            label: `${startLabel}-${endLabel}`,
            total,
            success,
            failed,
            skipped: 0,
            requisitions: Math.max(1, success - 2),
            backups: 1,
            security: idx % 3 === 0 ? 1 : 0,
            others: 0,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '1M') {
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dayLabel = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
          const idx = 29 - i;
          
          const dayOfWeek = d.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          const total = isWeekend ? (1 + idx % 3) : (8 + idx % 8);
          const success = total - (idx % 9 === 0 ? 1 : 0);
          const failed = total - success;
          const recipientsCount = Math.max(1, Math.ceil(total * 0.7));

          dataPoints.push({
            label: dayLabel,
            total,
            success,
            failed,
            skipped: isWeekend ? 1 : 0,
            requisitions: Math.max(0, success - 3),
            backups: 1,
            security: isWeekend ? 0 : 1,
            others: 0,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '1Y') {
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthLabel = d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
          const idx = 11 - i;
          
          const total = 120 + idx * 22 + (idx % 3) * 30;
          const success = Math.floor(total * 0.97);
          const failed = total - success;
          const recipientsCount = Math.max(5, Math.ceil(total * 0.45));

          dataPoints.push({
            label: monthLabel,
            total,
            success,
            failed,
            skipped: Math.floor(total * 0.01),
            requisitions: Math.floor(success * 0.72),
            backups: Math.floor(success * 0.16),
            security: Math.floor(success * 0.09),
            others: Math.floor(success * 0.03),
            recipientsCount
          });
        }
      }
    } else {
      if (graphTimeframe === '12H') {
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hourStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0);
          const hourEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 59, 59, 999);
          
          const logsInHour = allMergedLogs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime >= hourStart.getTime() && logTime <= hourEnd.getTime();
          });

          const success = logsInHour.filter(l => l.status === 'DELIVERED' || l.status === 'SIMULATED').length;
          const failed = logsInHour.filter(l => l.status === 'FAILED').length;
          const skipped = logsInHour.filter(l => l.status === 'SKIPPED').length;
          const total = logsInHour.length;

          const requisitions = logsInHour.filter(l => l.category === 'REQUISITION_WORKFLOW').length;
          const backups = logsInHour.filter(l => l.category === 'BACKUP_SNAPSHOT').length;
          const security = logsInHour.filter(l => l.category === 'PASSWORD_RESET').length;
          const others = total - (requisitions + backups + security);

          const recipientsCount = new Set(
            logsInHour
              .map(l => (l.recipientEmail || '').trim().toLowerCase())
              .filter(Boolean)
          ).size;

          const hourLabel = d.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          dataPoints.push({
            label: hourLabel,
            total,
            success,
            failed,
            skipped,
            requisitions,
            backups,
            security,
            others,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '24H') {
        for (let i = 23; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 60 * 60 * 1000);
          const hourStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0);
          const hourEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 59, 59, 999);

          const logsInHour = allMergedLogs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime >= hourStart.getTime() && logTime <= hourEnd.getTime();
          });

          const success = logsInHour.filter(l => l.status === 'DELIVERED' || l.status === 'SIMULATED').length;
          const failed = logsInHour.filter(l => l.status === 'FAILED').length;
          const skipped = logsInHour.filter(l => l.status === 'SKIPPED').length;
          const total = logsInHour.length;

          const requisitions = logsInHour.filter(l => l.category === 'REQUISITION_WORKFLOW').length;
          const backups = logsInHour.filter(l => l.category === 'BACKUP_SNAPSHOT').length;
          const security = logsInHour.filter(l => l.category === 'PASSWORD_RESET').length;
          const others = total - (requisitions + backups + security);

          const recipientsCount = new Set(
            logsInHour
              .map(l => (l.recipientEmail || '').trim().toLowerCase())
              .filter(Boolean)
          ).size;

          const hourLabel = d.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          dataPoints.push({
            label: hourLabel,
            total,
            success,
            failed,
            skipped,
            requisitions,
            backups,
            security,
            others,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '1D') {
        for (let i = 7; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
          const blockStart = new Date(d.getTime() - 3 * 60 * 60 * 1000);
          const blockEnd = d;

          const logsInBlock = allMergedLogs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime > blockStart.getTime() && logTime <= blockEnd.getTime();
          });

          const success = logsInBlock.filter(l => l.status === 'DELIVERED' || l.status === 'SIMULATED').length;
          const failed = logsInBlock.filter(l => l.status === 'FAILED').length;
          const skipped = logsInBlock.filter(l => l.status === 'SKIPPED').length;
          const total = logsInBlock.length;

          const requisitions = logsInBlock.filter(l => l.category === 'REQUISITION_WORKFLOW').length;
          const backups = logsInBlock.filter(l => l.category === 'BACKUP_SNAPSHOT').length;
          const security = logsInBlock.filter(l => l.category === 'PASSWORD_RESET').length;
          const others = total - (requisitions + backups + security);

          const recipientsCount = new Set(
            logsInBlock
              .map(l => (l.recipientEmail || '').trim().toLowerCase())
              .filter(Boolean)
          ).size;

          const startLabel = blockStart.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          const endLabel = blockEnd.toLocaleTimeString('en-KE', { hour: 'numeric', hour12: true });
          dataPoints.push({
            label: `${startLabel}-${endLabel}`,
            total,
            success,
            failed,
            skipped,
            requisitions,
            backups,
            security,
            others,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '1M') {
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
          const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

          const logsInDay = allMergedLogs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime >= dayStart.getTime() && logTime <= dayEnd.getTime();
          });

          const success = logsInDay.filter(l => l.status === 'DELIVERED' || l.status === 'SIMULATED').length;
          const failed = logsInDay.filter(l => l.status === 'FAILED').length;
          const skipped = logsInDay.filter(l => l.status === 'SKIPPED').length;
          const total = logsInDay.length;

          const requisitions = logsInDay.filter(l => l.category === 'REQUISITION_WORKFLOW').length;
          const backups = logsInDay.filter(l => l.category === 'BACKUP_SNAPSHOT').length;
          const security = logsInDay.filter(l => l.category === 'PASSWORD_RESET').length;
          const others = total - (requisitions + backups + security);

          const recipientsCount = new Set(
            logsInDay
              .map(l => (l.recipientEmail || '').trim().toLowerCase())
              .filter(Boolean)
          ).size;

          const dayLabel = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
          dataPoints.push({
            label: dayLabel,
            total,
            success,
            failed,
            skipped,
            requisitions,
            backups,
            security,
            others,
            recipientsCount
          });
        }
      } else if (graphTimeframe === '1Y') {
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

          const logsInMonth = allMergedLogs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime >= monthStart.getTime() && logTime <= monthEnd.getTime();
          });

          const success = logsInMonth.filter(l => l.status === 'DELIVERED' || l.status === 'SIMULATED').length;
          const failed = logsInMonth.filter(l => l.status === 'FAILED').length;
          const skipped = logsInMonth.filter(l => l.status === 'SKIPPED').length;
          const total = logsInMonth.length;

          const requisitions = logsInMonth.filter(l => l.category === 'REQUISITION_WORKFLOW').length;
          const backups = logsInMonth.filter(l => l.category === 'BACKUP_SNAPSHOT').length;
          const security = logsInMonth.filter(l => l.category === 'PASSWORD_RESET').length;
          const others = total - (requisitions + backups + security);

          const recipientsCount = new Set(
            logsInMonth
              .map(l => (l.recipientEmail || '').trim().toLowerCase())
              .filter(Boolean)
          ).size;

          const monthLabel = d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
          dataPoints.push({
            label: monthLabel,
            total,
            success,
            failed,
            skipped,
            requisitions,
            backups,
            security,
            others,
            recipientsCount
          });
        }
      }
    }

    return {
      points: dataPoints,
      isMock
    };
  }, [allMergedLogs, graphTimeframe]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();

    return allMergedLogs.filter(log => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesQuery = 
          log.recipientEmail.toLowerCase().includes(query) ||
          (log.recipientName && log.recipientName.toLowerCase().includes(query)) ||
          log.subject.toLowerCase().includes(query) ||
          log.details.toLowerCase().includes(query) ||
          log.performedBy.toLowerCase().includes(query) ||
          (log.requisitionId && log.requisitionId.toLowerCase().includes(query)) ||
          (log.requisitionTitle && log.requisitionTitle.toLowerCase().includes(query));

        if (!matchesQuery) return false;
      }

      // 2. Category filter
      if (categoryFilter !== 'ALL') {
        if (log.category !== categoryFilter) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'ALL') {
        if (log.status !== statusFilter) return false;
      }

      // 4. Date filter
      if (dateRangeFilter !== 'ALL') {
        const logTime = new Date(log.timestamp).getTime();
        if (isNaN(logTime)) return true;

        if (dateRangeFilter === 'TODAY') {
          if (now - logTime > 24 * 60 * 60 * 1000) return false;
        } else if (dateRangeFilter === '7DAYS') {
          if (now - logTime > 7 * 24 * 60 * 60 * 1000) return false;
        } else if (dateRangeFilter === '30DAYS') {
          if (now - logTime > 30 * 24 * 60 * 60 * 1000) return false;
        }
      }

      return true;
    });
  }, [allMergedLogs, searchTerm, categoryFilter, statusFilter, dateRangeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportEmailLogsCsv = () => {
    if (filteredLogs.length === 0) {
      triggerToast({ type: 'SYSTEM_INFO', message: 'No email logs available to export.', severity: 'LOW', timestamp: new Date().toISOString() });
      return;
    }

    const headers = ['Timestamp', 'Action', 'Category', 'Recipient Email', 'Recipient Name', 'Subject', 'Requisition ID', 'Status', 'Performed By', 'Details'];
    const rows = filteredLogs.map(l => [
      new Date(l.timestamp).toISOString(),
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      `"${(l.recipientEmail || '').replace(/"/g, '""')}"`,
      `"${(l.recipientName || '').replace(/"/g, '""')}"`,
      `"${(l.subject || '').replace(/"/g, '""')}"`,
      `"${(l.requisitionId || '').replace(/"/g, '""')}"`,
      `"${(l.status || '').replace(/"/g, '""')}"`,
      `"${(l.performedBy || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stands_email_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast({ type: 'SYSTEM_INFO', message: `Exported ${filteredLogs.length} email audit logs.`, severity: 'LOW', timestamp: new Date().toISOString() });
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes('@')) {
      triggerToast({ type: 'SYSTEM_INFO', message: 'Please enter a valid email address.', severity: 'HIGH', timestamp: new Date().toISOString() });
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testRecipient,
          subject: testSubject,
          testType: testType,
          performer: currentUser ? `${currentUser.name} (${currentUser.role})` : 'SUPER_ADMIN'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        triggerToast({ type: 'SYSTEM_INFO', message: `Test email recorded successfully (${data.status}).`, severity: 'LOW', timestamp: new Date().toISOString() });
        setShowTestEmailModal(false);
        fetchEmailLogs();
      } else {
        triggerToast({ type: 'SYSTEM_INFO', message: data.error || 'Failed to dispatch diagnostic test email', severity: 'HIGH', timestamp: new Date().toISOString() });
      }
    } catch (err: any) {
      triggerToast({ type: 'SYSTEM_INFO', message: `Error: ${err.message}`, severity: 'HIGH', timestamp: new Date().toISOString() });
    } finally {
      setIsSendingTest(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'REQUISITION_WORKFLOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <FileText size={12} className="text-blue-500" />
            Requisition
          </span>
        );
      case 'BACKUP_SNAPSHOT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Database size={12} className="text-indigo-500" />
            Backup Snapshot
          </span>
        );
      case 'PASSWORD_RESET':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <KeyRound size={12} className="text-purple-500" />
            Auth & Security
          </span>
        );
      case 'BULK_ANNOUNCEMENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Megaphone size={12} className="text-amber-500" />
            Announcement
          </span>
        );
      case 'DIGEST_SUMMARY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Sparkles size={12} className="text-emerald-500" />
            Executive Digest
          </span>
        );
      case 'SYSTEM_ALERT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <Bell size={12} className="text-rose-500" />
            System Alert
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Mail size={12} className="text-slate-500" />
            General
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Delivered
          </span>
        );
      case 'SIMULATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <Info size={12} className="text-blue-600" />
            Simulated / Dev
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle size={12} className="text-amber-600" />
            Skipped
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <X size={12} className="text-rose-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Clock size={12} className="text-slate-500" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Email Logs</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Mail size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
            <span className="text-[10px] font-bold text-slate-500">records</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">All logged dispatch events</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient Users</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-sky-600">{stats.uniqueUsersCount}</span>
            <span className="text-[10px] font-bold text-slate-500">recipients</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Distinct users receiving emails</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Requisition Notices</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">{stats.requisitionEmails}</span>
            <span className="text-[10px] font-bold text-slate-500">workflows</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Approvals, vouchers & receipts</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Backup Snapshots</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Database size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600">{stats.backupEmails}</span>
            <span className="text-[10px] font-bold text-slate-500">dispatches</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">JSON database archives</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security & Auth</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{stats.securityEmails}</span>
            <span className="text-[10px] font-bold text-slate-500">resets/alerts</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Passwords & account alerts</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Health</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Server size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{stats.successRate}%</span>
            <span className="text-[10px] font-bold text-emerald-700">active</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">
            {stats.delivered} sent • {stats.simulated} sim • {stats.failed} err
          </p>
        </div>
      </div>

      {/* 1b. Interactive Chart Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider">Email Dispatch Audit Volume</h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                <Users size={10} className="text-sky-600" />
                {stats.uniqueUsersCount} Recipient User{stats.uniqueUsersCount === 1 ? '' : 's'}
              </span>
              {chartData.isMock && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
                  <Sparkles size={10} />
                  Sandbox Simulation
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Real-time mailer analytics, recipient user activity & network traffic visualization</p>
          </div>

          {/* Timeframe Selectors & Breakdown Modes */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Breakdown Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setGraphViewMode('STATUS')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  graphViewMode === 'STATUS'
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Delivery Status
              </button>
              <button
                type="button"
                onClick={() => setGraphViewMode('CATEGORY')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  graphViewMode === 'CATEGORY'
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                Category
              </button>
            </div>

            {/* Timeframe Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(['12H', '24H', '1D', '1M', '1Y'] as const).map((tf) => {
                const labelMap = {
                  '12H': '12 Hrs',
                  '24H': '24 Hrs',
                  '1D': '1 Day',
                  '1M': '1 Month',
                  '1Y': '1 Year'
                };
                return (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setGraphTimeframe(tf)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      graphTimeframe === tf
                        ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {labelMap[tf]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-64 w-full relative pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {graphViewMode === 'STATUS' ? (
              <AreaChart data={chartData.points} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="label" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 max-w-xs space-y-1.5 text-[10px]">
                          <div className="font-bold text-slate-400 font-mono">
                            {data.label}
                          </div>
                          <div className="divide-y divide-slate-800">
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-emerald-400 font-sans">SUCCESS:</span>
                              <span className="font-black font-mono text-emerald-300">{data.success}</span>
                            </div>
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-rose-400 font-sans">FAILED:</span>
                              <span className="font-black font-mono text-rose-300">{data.failed}</span>
                            </div>
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-amber-400 font-sans">SKIPPED:</span>
                              <span className="font-black font-mono text-amber-300">{data.skipped}</span>
                            </div>
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-sky-400 font-sans">RECIPIENT USERS:</span>
                              <span className="font-black font-mono text-sky-300">{data.recipientsCount} {data.recipientsCount === 1 ? 'user' : 'users'}</span>
                            </div>
                            <div className="py-1 pt-1.5 flex justify-between gap-6 font-bold border-t border-slate-800">
                              <span className="text-slate-200">TOTAL VOLUME:</span>
                              <span className="font-black font-mono text-white text-xs">{data.total}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSuccess)" name="Success (Delivered/Simulated)" />
                <Area type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" name="Failed" />
              </AreaChart>
            ) : (
              <BarChart data={chartData.points} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="label" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 9, fontWeight: 700 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 max-w-xs space-y-1.5 text-[10px]">
                          <div className="font-bold text-slate-400 font-mono">
                            {data.label}
                          </div>
                          <div className="divide-y divide-slate-800">
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-blue-400 font-sans">REQUISITIONS:</span>
                              <span className="font-black font-mono text-blue-300">{data.requisitions}</span>
                            </div>
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-purple-400 font-sans">BACKUPS:</span>
                              <span className="font-black font-mono text-purple-300">{data.backups}</span>
                            </div>
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-amber-400 font-sans">SECURITY & AUTH:</span>
                              <span className="font-black font-mono text-amber-300">{data.security}</span>
                            </div>
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-slate-400 font-sans">OTHERS:</span>
                              <span className="font-black font-mono text-slate-300">{data.others}</span>
                            </div>
                            <div className="py-1 flex justify-between gap-6">
                              <span className="font-bold text-sky-400 font-sans">RECIPIENT USERS:</span>
                              <span className="font-black font-mono text-sky-300">{data.recipientsCount} {data.recipientsCount === 1 ? 'user' : 'users'}</span>
                            </div>
                            <div className="py-1 pt-1.5 flex justify-between gap-6 font-bold border-t border-slate-800">
                              <span className="text-slate-200">TOTAL VOLUME:</span>
                              <span className="font-black font-mono text-white text-xs">{data.total}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="requisitions" stackId="a" fill="#3b82f6" name="Requisitions" radius={[0, 0, 0, 0]} />
                <Bar dataKey="backups" stackId="a" fill="#a855f7" name="Backups" radius={[0, 0, 0, 0]} />
                <Bar dataKey="security" stackId="a" fill="#f59e0b" name="Security & Auth" radius={[0, 0, 0, 0]} />
                <Bar dataKey="others" stackId="a" fill="#64748b" name="Others" radius={[2, 2, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend Indicator Panel */}
        <div className="flex flex-wrap justify-center gap-6 pt-2 border-t border-slate-100 text-[10px] font-bold uppercase tracking-wider">
          {graphViewMode === 'STATUS' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-emerald-500 rounded-sm" />
                <span className="text-slate-600">Success Dispatches (Sent/Simulated)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-rose-500 rounded-sm" />
                <span className="text-slate-600">Failed Dispatches</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-sky-500 rounded-sm" />
                <span className="text-slate-600">Users Receiving Emails: {stats.uniqueUsersCount} Unique</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-blue-500 rounded-sm" />
                <span className="text-slate-600">Requisitions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-purple-500 rounded-sm" />
                <span className="text-slate-600">Backups</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-amber-500 rounded-sm" />
                <span className="text-slate-600">Security & Auth</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-slate-500 rounded-sm" />
                <span className="text-slate-600">Others</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-sky-500 rounded-sm" />
                <span className="text-slate-600">Users Receiving Emails: {stats.uniqueUsersCount} Unique</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 2. Search, Filter, and Action Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by recipient email, subject, requisition title, or trigger user..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowTestEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            >
              <Send size={14} />
              Send Test Email
            </button>
            <button
              onClick={exportEmailLogsCsv}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={fetchEmailLogs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Filter size={12} /> Category:
            </span>
            {[
              { key: 'ALL', label: 'All' },
              { key: 'REQUISITION_WORKFLOW', label: 'Requisitions' },
              { key: 'BACKUP_SNAPSHOT', label: 'Backups' },
              { key: 'PASSWORD_RESET', label: 'Security & Auth' },
              { key: 'BULK_ANNOUNCEMENT', label: 'Announcements' },
              { key: 'SYSTEM_ALERT', label: 'Alerts' }
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => {
                  setCategoryFilter(cat.key);
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                  categoryFilter === cat.key
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status & Date Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Selector */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered Only</option>
              <option value="SIMULATED">Simulated / Safe</option>
              <option value="SKIPPED">Skipped</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Date Window */}
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Last 24 Hours</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Email Logs Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="text-primary" size={18} />
            <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider">
              Email Dispatch Ledger ({filteredLogs.length} Records)
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Showing {filteredLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Mail size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No email audit logs matched your query</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try adjusting your search keywords, clear active category filters, or click "Send Test Email" to generate an initial diagnostic verification log.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
                setDateRangeFilter('ALL');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Subject & Context</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Dispatched By</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedLogs.map((log) => {
                  const logDate = new Date(log.timestamp);
                  const isValidDate = !isNaN(logDate.getTime());
                  const formattedDate = isValidDate ? logDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                  const formattedTime = isValidDate ? logDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 font-mono text-[11px]">{formattedDate}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{formattedTime}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getCategoryBadge(log.category)}
                      </td>

                      {/* Recipient */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 font-mono text-[11px] truncate block" title={log.recipientEmail}>
                            {log.recipientEmail}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(log.recipientEmail, log.id);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy email"
                          >
                            {copiedId === log.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                        {log.recipientName && log.recipientName !== log.recipientEmail && (
                          <div className="text-[10px] text-slate-500 truncate">{log.recipientName}</div>
                        )}
                        {log.ccList && log.ccList.length > 0 && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] font-bold rounded">
                            +{log.ccList.length} CC
                          </span>
                        )}
                      </td>

                      {/* Subject & Context */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-800 line-clamp-1" title={log.subject}>
                          {log.subject}
                        </div>
                        <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 flex items-center gap-2">
                          {log.requisitionId && (
                            <span className="font-mono text-primary font-bold">{log.requisitionId}</span>
                          )}
                          {log.amount && (
                            <span className="font-bold text-emerald-700">KES {Number(log.amount).toLocaleString()}</span>
                          )}
                          {log.sizeKb && (
                            <span className="font-mono text-slate-400">{log.sizeKb} KB</span>
                          )}
                          {!log.requisitionId && !log.amount && !log.sizeKb && (
                            <span>{log.details}</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>

                      {/* Dispatched By */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-[11px] font-semibold text-slate-700">{log.performedBy}</div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Trigger Actor</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                        >
                          <Eye size={12} />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredLogs.length > itemsPerPage && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="text-xs text-slate-500 font-medium">
              Page <span className="font-bold text-slate-800">{currentPage}</span> of <span className="font-bold text-slate-800">{totalPages}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = Math.min(currentPage - 2 + i, totalPages);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      currentPage === pageNum
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Log Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black uppercase text-slate-900 tracking-tight">Email Dispatch Audit Record</h3>
                    {getStatusBadge(selectedLog.status)}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Transaction Key Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Recipient</span>
                <div className="font-bold text-slate-900 font-mono text-xs">{selectedLog.recipientEmail}</div>
                {selectedLog.recipientName && (
                  <div className="text-[11px] text-slate-500">{selectedLog.recipientName}</div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Category & Type</span>
                <div>{getCategoryBadge(selectedLog.category)}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">{selectedLog.action}</div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dispatched Timestamp</span>
                <div className="font-bold text-slate-800 font-mono text-xs">
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{selectedLog.timestamp}</div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Trigger Actor / Source</span>
                <div className="font-bold text-slate-800 text-xs">{selectedLog.performedBy}</div>
                <div className="text-[10px] text-emerald-600 font-semibold">Authorized Audit Trail Event</div>
              </div>
            </div>

            {/* Subject and Context */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Subject Line & Context</span>
              <p className="text-xs font-bold text-slate-900">{selectedLog.subject}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{selectedLog.details}</p>
              {selectedLog.requisitionId && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500">Linked Requisition:</span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-black rounded font-mono">
                    {selectedLog.requisitionId}
                  </span>
                  {selectedLog.amount && (
                    <span className="text-[11px] font-bold text-emerald-700">
                      (KES {Number(selectedLog.amount).toLocaleString()})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* CC List if present */}
            {selectedLog.ccList && selectedLog.ccList.length > 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Copied Recipients (CC List)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLog.ccList.map((ccEmail, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-700">
                      {ccEmail}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* JSON Metadata Payload */}
            {selectedLog.metadata && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Structured Payload Metadata</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedLog.metadata, null, 2), 'payload')}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    {copiedId === 'payload' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedId === 'payload' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-[10px] font-mono overflow-x-auto max-h-40 leading-relaxed">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Diagnostic Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider">Send Diagnostic Test Email</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Verify SMTP mailer routing & log live audit event</p>
                </div>
              </div>
              <button
                onClick={() => setShowTestEmailModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Recipient Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ict.team@pceastandrews.org"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Subject</label>
                <input
                  type="text"
                  required
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Test Scenario</label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="DIAGNOSTIC_VERIFICATION">Diagnostic Verification Check</option>
                  <option value="REQUISITION_WORKFLOW_TEST">Requisition Workflow Notice Simulation</option>
                  <option value="BACKUP_DISPATCH_TEST">Backup Snapshot Delivery Verification</option>
                  <option value="PASSWORD_RESET_TEST">Password Reset Alert Verification</option>
                </select>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 space-y-1 text-indigo-950">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 block">Audit Guarantee</span>
                <p className="text-[11px] text-indigo-900 leading-relaxed">
                  Executing this diagnostic will immediately append a verified <code className="font-mono bg-white px-1 py-0.5 rounded text-indigo-700 font-bold">EMAIL_DISPATCH</code> audit entry into the ledger with full delivery timestamps and actor authentication.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTestEmailModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSendingTest ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {isSendingTest ? 'Dispatching...' : 'Dispatch Test Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
