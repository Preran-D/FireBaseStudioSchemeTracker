'use client';

import { useEffect } from 'react';
import { autoArchiveClosedSchemesByGracePeriod } from '@/lib/mock-data';

const DEFAULT_GRACE_PERIOD_DAYS = 60; // Default grace period

export function AutoArchiveTrigger() {
  useEffect(() => {
    console.log('AutoArchiveTrigger: Running automatic archival of closed schemes...');
    try {
      const result = autoArchiveClosedSchemesByGracePeriod(DEFAULT_GRACE_PERIOD_DAYS);
      if (result.archivedCount > 0) {
        console.log(`AutoArchiveTrigger: Successfully auto-archived ${result.archivedCount} scheme(s).`);
      } else {
        console.log('AutoArchiveTrigger: No schemes were eligible for auto-archiving at this time.');
      }
    } catch (error) {
      console.error('AutoArchiveTrigger: Error during automatic archival:', error);
    }
  }, []); // Empty dependency array ensures this runs once on mount

  return null; // This component does not render anything
}
