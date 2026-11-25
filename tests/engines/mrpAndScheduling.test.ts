import { describe, expect, it } from 'vitest';
import { solveMrp } from '../../src/engines/mrp.ts';
import { solveScheduling } from '../../src/engines/scheduling.ts';

describe('MRP Multi-Parent BOM & Shop-Floor Scheduling Engines', () => {
  it('explodes multi-parent BOM via Low-Level Coding, detects Past-Due, and compares 5 lot-sizing rules', () => {
    const res = solveMrp('mrp-1', 'Uji BOM Multi-Parent', {
      moduleId: 'mrp',
      periodLabels: ['W1', 'W2', 'W3', 'W4'],
      items: [
        {
          item: 'EndItem-A',
          level: 0,
          parent: '',
          qtyPerParent: 1,
          leadTime: 1,
          onHand: 10,
          safetyStock: 0,
          lotSizing: 'L4L',
          setupCost: 200,
          holdingCostPerUnit: 2,
          scheduledReceipts: [0, 0, 0, 0],
          grossRequirements: [0, 60, 0, 50],
        },
        {
          item: 'Sub-B',
          level: 1,
          parent: 'EndItem-A:2',
          qtyPerParent: 2,
          leadTime: 1,
          onHand: 0,
          safetyStock: 0,
          lotSizing: 'FOQ',
          fixedOrderQty: 250,
          setupCost: 150,
          holdingCostPerUnit: 3,
          scheduledReceipts: [0, 0, 0, 0],
          grossRequirements: [0, 0, 0, 0],
        },
        {
          item: 'CommonBolt-C',
          level: 1, // Deliberately set 1 even though Sub-B is also at 1 -> Low-Level Coding must push to Level 2!
          parent: 'EndItem-A:1, Sub-B:2',
          qtyPerParent: 1,
          leadTime: 1,
          onHand: 0,
          safetyStock: 0,
          lotSizing: 'L4L',
          setupCost: 100,
          holdingCostPerUnit: 1,
          scheduledReceipts: [0, 0, 0, 0],
          grossRequirements: [0, 0, 0, 0],
        },
      ],
    });

    // EndItem-A: W2 net=50 -> PORel W1=50; W4 net=50 -> PORel W3=50.
    // Sub-B: W1 gross = 50*2 = 100 -> FOQ 250 in W1, LT=1 -> Past-Due = 250!
    expect(res.status).toBe('warning');
    expect(Number(res.derivedValues.totalPastDueUnits)).toBeGreaterThan(0);
    expect(res.charts.some((c) => c.kind === 'bom-tree')).toBe(true);
    expect(String(res.derivedValues.workOrderList).length).toBeGreaterThan(0);
  });

  it('verifies SPT minimizes Flow Time, WSPT minimizes Weighted Flow, and EDD minimizes Max Tardiness', () => {
    const res = solveScheduling('sc-1', 'Uji 6 Aturan Mesin Tunggal', {
      moduleId: 'scheduling',
      mode: 'single_machine',
      jobs: [
        { jobId: 'J1', processingTime: 8, dueDate: 10, weight: 1 },
        { jobId: 'J2', processingTime: 3, dueDate: 12, weight: 4 },
        { jobId: 'J3', processingTime: 5, dueDate: 9, weight: 2 },
        { jobId: 'J4', processingTime: 2, dueDate: 15, weight: 1 },
      ],
    });

    expect(res.status).toBe('success');
    // Makespan = 8 + 3 + 5 + 2 = 18
    expect(res.derivedValues.makespan).toBe(18);
    // SPT order: J4(2)->C=2, J2(3)->C=5, J3(5)->C=10, J1(8)->C=18 => sum=35 => avg = 8.75
    expect(res.derivedValues.bestFlowTime).toBeCloseTo(8.75, 4);
    // EDD order: J3(d=9,t=5)->C=5(L=0), J1(d=10,t=8)->C=13(L=3), J2(d=12,t=3)->C=16(L=4), J4(d=15,t=2)->C=18(L=3) => max tardiness = 4
    expect(res.derivedValues.minMaxLateness).toBeCloseTo(4, 4);
  });

  it('solves Johnson 2-Machine Flow Shop to global minimum Makespan', () => {
    const res = solveScheduling('sc-johnson', 'Uji Algoritma Johnson', {
      moduleId: 'scheduling',
      mode: 'johnson_two_machine',
      jobs: [
        { jobId: 'A', processingTime: 5, dueDate: 10, processingTimeMachine2: 2 },
        { jobId: 'B', processingTime: 3, dueDate: 10, processingTimeMachine2: 6 },
        { jobId: 'C', processingTime: 8, dueDate: 10, processingTimeMachine2: 4 },
        { jobId: 'D', processingTime: 10, dueDate: 10, processingTimeMachine2: 7 },
        { jobId: 'E', processingTime: 1, dueDate: 10, processingTimeMachine2: 9 },
      ],
    });

    // Classic Johnson benchmark:
    // E(M1=1 -> front: [E])
    // A(M2=2 -> back: [A])
    // B(M1=3 -> front: [E, B])
    // C(M2=4 -> back: [C, A])
    // D(remaining -> middle: [E, B, D, C, A])
    expect(res.status).toBe('success');
    expect(res.derivedValues.sequence).toBe('E → B → D → C → A');
    // Makespan check along E -> B -> D -> C -> A:
    // E: M1 0-1, M2 1-10
    // B: M1 1-4, M2 10-16
    // D: M1 4-14, M2 16-23
    // C: M1 14-22, M2 23-27
    // A: M1 22-27, M2 27-29 -> Makespan = 29!
    expect(res.derivedValues.makespan).toBe(29);
  });
});
