/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Expense, Group, Settlement, User } from '../types';

export interface GroupSpendSummary {
  groupId: string;
  groupName: string;
  totalSpent: number;
  fairShare: number;
  netBalance: number; // positive = should receive, negative = owes
}

export interface ProposedSettlement {
  fromGroupId: string;
  fromGroupName: string;
  toGroupId: string;
  toGroupName: string;
  amount: number;
}

/**
 * Calculations for Family group expenses and mutual settlements.
 */
export function calculateGroupSettlements(
  expenses: Expense[],
  groups: Group[],
  splitMethod: 'equal_groups' | 'member_count' = 'equal_groups',
  users: User[] = []
): {
  summaries: GroupSpendSummary[];
  totalFamilySpend: number;
  proposals: ProposedSettlement[];
} {
  const totalFamilySpend = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  // Initialize summaries
  const summaries: GroupSpendSummary[] = groups.map(g => {
    const groupSpent = expenses
      .filter(exp => exp.groupId === g.id)
      .reduce((sum, exp) => sum + exp.amount, 0);

    return {
      groupId: g.id,
      groupName: g.name,
      totalSpent: groupSpent,
      fairShare: 0,
      netBalance: 0
    };
  });

  const numGroups = groups.length;
  if (numGroups === 0) {
    return { summaries: [], totalFamilySpend: 0, proposals: [] };
  }

  // Calculate Fair Share
  if (splitMethod === 'equal_groups') {
    const groupFairShare = totalFamilySpend / numGroups;
    summaries.forEach(s => {
      s.fairShare = groupFairShare;
      s.netBalance = s.totalSpent - groupFairShare;
    });
  } else {
    // Split by count of family members belonging to each group
    const totalMembers = users.length || 1;
    summaries.forEach(s => {
      const groupClassUsers = users.filter(usr => usr.groupId === s.groupId);
      const ratio = groupClassUsers.length / totalMembers;
      const groupFairShare = totalFamilySpend * ratio;
      s.fairShare = groupFairShare;
      s.netBalance = s.totalSpent - groupFairShare;
    });
  }

  // Calculate settlement proposals using a simple matching algorithm (Debtors pay Creditors)
  const debtors = summaries
    .filter(s => s.netBalance < -0.01)
    .map(s => ({ ...s, netBalance: Math.abs(s.netBalance) }))
    .sort((a, b) => b.netBalance - a.netBalance); // Sort descending to handle major debtors first

  const creditors = summaries
    .filter(s => s.netBalance > 0.01)
    .map(s => ({ ...s }))
    .sort((a, b) => b.netBalance - a.netBalance); // Sort descending to handle major creditors first

  const proposals: ProposedSettlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const minAmount = Math.min(debtor.netBalance, creditor.netBalance);
    if (minAmount > 0.1) {
      proposals.push({
        fromGroupId: debtor.groupId,
        fromGroupName: debtor.groupName,
        toGroupId: creditor.groupId,
        toGroupName: creditor.groupName,
        amount: Math.round(minAmount * 100) / 100
      });
    }

    debtor.netBalance -= minAmount;
    creditor.netBalance -= minAmount;

    if (debtor.netBalance < 0.1) {
      dIdx++;
    }
    if (creditor.netBalance < 0.1) {
      cIdx++;
    }
  }

  return {
    summaries,
    totalFamilySpend,
    proposals
  };
}
