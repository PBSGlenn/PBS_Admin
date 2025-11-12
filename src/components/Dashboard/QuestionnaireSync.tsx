/**
 * Questionnaire Sync Component
 * Displays unprocessed questionnaires from Jotform and allows manual sync
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Download, RefreshCw, CheckCircle2, XCircle, FileText, FileJson } from 'lucide-react';
import {
  fetchUnprocessedSubmissions,
  syncAllQuestionnaires,
  type JotformSubmission,
  type QuestionnaireSyncResult,
} from '@/lib/services/jotformService';

export function QuestionnaireSync() {
  const [submissions, setSubmissions] = useState<JotformSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<QuestionnaireSyncResult[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Fetch unprocessed submissions on mount
  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await fetchUnprocessedSubmissions();
      setSubmissions(data);
    } catch (error) {
      console.error('Failed to load questionnaire submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResults([]);
    try {
      const result = await syncAllQuestionnaires();
      setSyncResults(result.results);
      setLastSync(new Date());
      // Reload submissions to update the list
      await loadSubmissions();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearTracking = () => {
    if (window.confirm('Clear processed questionnaire tracking? This will allow re-processing of all questionnaires (for testing purposes).')) {
      localStorage.removeItem('pbs_admin_processed_jotform_submissions');
      setSyncResults([]);
      loadSubmissions();
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getFormType = (formId: string) => {
    const DOG_FORM_ID = import.meta.env.VITE_JOTFORM_DOG_FORM_ID;
    const CAT_FORM_ID = import.meta.env.VITE_JOTFORM_CAT_FORM_ID;

    if (formId === DOG_FORM_ID) return 'Dog';
    if (formId === CAT_FORM_ID) return 'Cat';
    return 'Unknown';
  };

  // Get client name from answers (QID 3)
  const getClientName = (submission: JotformSubmission): string => {
    const nameAnswer = submission.answers['3'];
    if (nameAnswer && typeof nameAnswer.answer === 'object') {
      const { first = '', last = '' } = nameAnswer.answer as any;
      return `${first} ${last}`.trim() || 'Unknown';
    }
    return 'Unknown';
  };

  // Get pet name from answers (QID 8)
  const getPetName = (submission: JotformSubmission): string => {
    const petAnswer = submission.answers['8'];
    return (petAnswer?.answer as string) || 'Unknown';
  };

  // Get email from answers (QID 6)
  const getEmail = (submission: JotformSubmission): string => {
    const emailAnswer = submission.answers['6'];
    return (emailAnswer?.answer as string) || 'No email';
  };

  if (submissions.length === 0 && !loading) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground mb-2">No new questionnaires</p>
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={loadSubmissions}
            disabled={loading}
            variant="outline"
            className="h-7 text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleClearTracking}
            variant="ghost"
            className="h-7 text-xs text-orange-600 hover:text-orange-700"
            title="Clear tracking (for testing)"
          >
            Clear Tracking
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with badge and buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {submissions.length > 0 && (
            <Badge variant="default" className="bg-purple-500 text-[10px] h-5">
              {submissions.length} new
            </Badge>
          )}
          {lastSync && (
            <span className="text-[10px] text-muted-foreground">
              Synced: {lastSync.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={loadSubmissions}
            disabled={loading}
            variant="outline"
            className="h-7 px-2"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {submissions.length > 0 && (
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="h-7 text-xs"
            >
              <Download className={`h-3 w-3 mr-1 ${syncing ? 'animate-bounce' : ''}`} />
              {syncing ? 'Processing...' : `Process ${submissions.length}`}
            </Button>
          )}
        </div>
      </div>

      {/* Sync results */}
      {syncResults.length > 0 && (
        <div className="space-y-1 p-2 bg-muted/50 rounded-md">
          <h4 className="text-[10px] font-semibold">Sync Results</h4>
          {syncResults.map((result, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px]">
              {result.success ? (
                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                {result.success ? (
                  <div className="space-y-0.5">
                    <div>
                      Processed <strong>{result.clientName}</strong> ({result.petName})
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      {result.filesDownloaded.json && (
                        <span className="flex items-center gap-0.5">
                          <FileJson className="h-2.5 w-2.5" /> JSON
                        </span>
                      )}
                      {result.filesDownloaded.pdf && (
                        <span className="flex items-center gap-0.5">
                          <FileText className="h-2.5 w-2.5" /> PDF
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div>Failed: {result.clientName}</div>
                    {result.error && (
                      <div className="text-[10px] text-red-500">{result.error}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submissions table */}
      {submissions.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-7 text-[11px] py-1">Type</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Client</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Pet</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Email</TableHead>
                <TableHead className="h-7 text-[11px] py-1">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id} className="h-10">
                  <TableCell className="py-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-5 ${
                        getFormType(submission.form_id) === 'Dog'
                          ? 'border-blue-500 text-blue-500'
                          : 'border-orange-500 text-orange-500'
                      }`}
                    >
                      {getFormType(submission.form_id)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs py-1 font-medium">
                    {getClientName(submission)}
                  </TableCell>
                  <TableCell className="text-xs py-1">
                    {getPetName(submission)}
                  </TableCell>
                  <TableCell className="text-[11px] py-1 text-muted-foreground">
                    {getEmail(submission)}
                  </TableCell>
                  <TableCell className="text-[11px] py-1 text-muted-foreground">
                    {formatDateTime(submission.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
