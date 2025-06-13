
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users2, Loader2 } from 'lucide-react';
import type { GroupDetail, Scheme } from '@/types/scheme';
// import { getGroupDetails, getMockSchemes } from '@/lib/mock-data'; // Replaced
import { getSupabaseSchemes } from '@/lib/supabase-data';
import Link from 'next/link';
// import { getPaymentStatus, calculateSchemeTotals, getSchemeStatus } from '@/lib/utils'; // Kept if needed for any specific client logic, but getSupabaseSchemes should provide processed schemes
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast'; // Added for error feedback

export default function GroupsPage() {
  // const [allSchemes, setAllSchemes] = useState<Scheme[]>([]); // No longer needed as state, schemes processed within loadData
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast(); // Added

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedSchemes = await getSupabaseSchemes(); // Fetches all schemes, already processed

      const groupsMap = new Map<string, {
        customerNames: Set<string>;
        schemesInGroup: Scheme[];
      }>();

      loadedSchemes.forEach(scheme => {
        if (scheme.customerGroupName && scheme.status !== 'Archived') { // Consider only non-archived schemes for active groups
          const groupEntry = groupsMap.get(scheme.customerGroupName) || {
            customerNames: new Set(),
            schemesInGroup: []
          };

          groupEntry.customerNames.add(scheme.customerName);
          groupEntry.schemesInGroup.push(scheme);
          groupsMap.set(scheme.customerGroupName, groupEntry);
        }
      });

      const derivedGroupDetails: GroupDetail[] = Array.from(groupsMap.entries()).map(([groupName, data]) => ({
        groupName,
        customerNames: Array.from(data.customerNames).sort((a,b) => a.localeCompare(b)),
        totalSchemesInGroup: data.schemesInGroup.length,
        // Note: `hasOverdueSchemeInGroup` and `recordableSchemeCount` are not in the current file's GroupDetail or UI
        // If needed later, they would be calculated here using data.schemesInGroup
      })).sort((a,b) => a.groupName.localeCompare(b.groupName)); // Sort groups by name

      setGroups(derivedGroupDetails);
    } catch (error) {
      console.error("Error loading group data:", error);
      toast({ title: "Error Loading Data", description: "Could not fetch group details. Please try again.", variant: "destructive" });
      setGroups([]); // Set to empty on error
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // Added toast

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredGroups = groups.filter(group => 
    group.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const listItemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.03, duration: 0.3 }
    }),
  };

  if (isLoading && groups.length === 0) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <h1 className="text-4xl font-headline font-semibold text-foreground flex items-center">
          <Users2 className="mr-3 h-10 w-10 text-primary" />
          Customer Groups ({filteredGroups.length})
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <Card className="rounded-xl shadow-xl overflow-hidden glassmorphism">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl font-headline text-foreground">Group Overview</CardTitle>
            <CardDescription>
              Browse customer groups. Groups are created when adding new schemes or by assigning schemes to a group.
              Click on a group name to view its details and manage payments.
            </CardDescription>
            <div className="mt-6">
              <Input
                placeholder="Filter by group name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md rounded-lg text-base h-11"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg mb-2">
                  {searchTerm && groups.length > 0 
                    ? 'No groups match your filter.' 
                    : (groups.length === 0 && !isLoading 
                        ? 'No customer groups exist yet.' 
                        : 'Loading groups or no groups found.')
                  }
                </p>
                {groups.length === 0 && !isLoading && (
                  <p className="text-sm">
                    You can create groups by assigning a "Customer Group Name" when
                    <Button variant="link" asChild className="p-1 text-base">
                      <Link href="/schemes/new">adding a new scheme</Link>
                    </Button>.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 dark:bg-muted/20">
                      <TableHead className="text-base font-semibold">Group Name</TableHead>
                      <TableHead className="text-base font-semibold text-center">Customers</TableHead>
                      <TableHead className="text-base font-semibold text-center">Total Schemes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group, index) => (
                      <motion.tr 
                        key={group.groupName}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                        variants={listItemVariants}
                        initial="hidden"
                        animate="visible"
                        custom={index}
                      >
                        <TableCell className="font-medium text-base">
                          <Link href={`/groups/${encodeURIComponent(group.groupName)}`} className="text-primary hover:underline">
                            {group.groupName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center text-base text-muted-foreground">{group.customerNames.length}</TableCell>
                        <TableCell className="text-center text-base text-muted-foreground">{group.totalSchemesInGroup}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
    
