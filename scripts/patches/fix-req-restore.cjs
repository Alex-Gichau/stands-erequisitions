const fs = require('fs');
const filePath = 'src/lib/databaseService.ts';
let content = fs.readFileSync(filePath, 'utf8');

const reqBlock = `
      // 3. Migrate Requisitions
      let migratedRequisitions = 0;
      try {
        const reqSnap = await getDocs(collection(firestoreDb, "requisitions"));
        for (const rDoc of reqSnap.docs) {
          const r = rDoc.data() as Requisition;
          try {
            const { error } = await supabase.from("requisitions").upsert({
              id: r.id,
              project_id: r.projectId || null,
              title: r.title,
              description: r.description,
              amount: r.amount,
              amount_words: r.amountWords || null,
              group_id: r.groupId,
              group_name: r.groupName,
              requester_id: r.requesterId,
              requester_name: r.requesterName,
              requester_email: r.requesterEmail || null,
              status: r.status,
              submitted_at: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
              updated_at: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
              expires_at: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
              escalation_level: r.escalationLevel || 0,
              escalation_notifications_sent: r.escalationNotificationsSent || false,
              approved_at_l1: r.approvedAtL1 ? new Date(r.approvedAtL1).toISOString() : null,
              approved_at_l2: r.approvedAtL2 ? new Date(r.approvedAtL2).toISOString() : null,
              disbursed_at: r.disbursedAt ? new Date(r.disbursedAt).toISOString() : null,
              rejection_reason: r.rejectionReason || null,
              approval_history: r.approvalHistory || [],
              digital_signature: r.digitalSignature || null,
              payable_to: r.payableTo || null,
              recurrence: r.recurrence || null,
              last_recurrence_generated_at: r.lastRecurrenceGeneratedAt ? new Date(r.lastRecurrenceGeneratedAt).toISOString() : null,
              additional_info: r.additionalInfo || null,
              attachments: r.attachments || [],
              receipts: r.receipts || [],
              flagged_for_audit: r.flaggedForAudit || false,
              in_procurement: r.inProcurement || false,
              requires_more_info: r.requiresMoreInfo || false,
              fiscal_year: r.fiscalYear || null
            });
            if (error) throw error;
            migratedRequisitions++;
          } catch (rErr: any) {
            const errMsg = \`Requisition [\${r.title}] migration failed: \${rErr.message || JSON.stringify(rErr)}\`;
            console.log(\`[DatabaseService] \${errMsg}\`, rErr);
            if (warnings) warnings.push(errMsg);
          }
        }
      } catch (err: any) {
        if (!err.message?.includes("permissions")) {
          console.info("Failed fetching requisitions from Firestore:", err.message);
          if (warnings) warnings.push(\`Failed fetching requisitions from Firestore: \${err.message}\`);
        }
      }

      // 4. Migrate Alerts`;

content = content.replace('      // 4. Migrate Alerts', reqBlock);

content = content.replace(/catch \(err: any\) \{\s*console\.log\("Failed fetching ([^"]+)", err\.message\);\s*\}/g, 
  `catch (err: any) {
        if (!err.message?.includes("permissions")) {
          console.info("Failed fetching $1", err.message);
        }
      }`);

fs.writeFileSync(filePath, content);
console.log('Restored requisitions and fixed down logs');
