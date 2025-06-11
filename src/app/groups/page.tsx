
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users2, Loader2 } from 'lucide-react';
import type { GroupDetail, Scheme } from '@/types/scheme';
import { getGroupDetails, getMockSchemes } from '@/lib/mock-data';
import Link from 'next/link';
import { getPaymentStatus, calculateSchemeTotals, getSchemeStatus } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

export default function GroupsPage() {
  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(() => {
    setIsLoading(true);
    const loadedSchemesRaw = getMockSchemes();
    const processedSchemes = loadedSchemesRaw.map(s => {
        const tempS = { ...s };
        tempS.payments.forEach(p => p.status = getPaymentStatus(p, tempS.startDate));
        const totals = calculateSchemeTotals(tempS);
        const status = getSchemeStatus(tempS);
        return { ...tempS, ...totals, status };
      });
    setAllSchemes(processedSchemes);
    const details = getGroupDetails(); // This function now includes hasOverdueSchemeInGroup
    setGroups(details);
    setIsLoading(false);
  }, []);

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
          Customer Groups
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
    
