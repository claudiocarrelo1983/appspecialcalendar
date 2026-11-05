-- Read-only diagnosis for the task shown in the screenshot. No records are changed.
SELECT
    t.id AS task_id,
    t.title,
    t.type AS task_type,
    t.active AS task_active,
    t.status AS task_status,
    t.company_code AS task_company,
    t.assigned_to,
    u.id AS assignee_user_id,
    u.full_name AS assignee_name,
    u.level AS assignee_level,
    u.active AS assignee_active,
    u.status AS assignee_status,
    u.company_code AS assignee_company,
    u.company_code_parent AS assignee_parent_company,
    t.created_date AS original_created_at,
    t.task_date AS scheduled_date,
    t.task_time AS scheduled_time,
    a.assigned_at AS last_assignment_notification,
    COALESCE(c.completed_rows, 0) AS completed_checklist_rows,
    NOW() AS server_now,
    CASE
        WHEN u.id IS NULL THEN 'ASSIGNEE_GUID_NOT_FOUND'
        WHEN u.active <> 1 OR u.status <> 10 THEN 'ASSIGNEE_INACTIVE'
        WHEN u.company_code <> t.company_code
             AND COALESCE(u.company_code_parent, '') <> t.company_code THEN 'ASSIGNEE_COMPANY_MISMATCH'
        WHEN t.active <> 1 THEN 'TASK_INACTIVE'
        WHEN t.type <> 'task' THEN 'WRONG_TASK_TYPE'
        WHEN t.status IN ('completed', 'resolved', 'cancelled') THEN 'TASK_ALREADY_FINISHED'
        WHEN COALESCE(c.completed_rows, 0) > 0 THEN 'CHECKLIST_ALREADY_COMPLETED'
        WHEN COALESCE(a.assigned_at, t.created_date) IS NULL
             OR COALESCE(a.assigned_at, t.created_date) = '0000-00-00 00:00:00' THEN 'MISSING_NOTIFICATION_TIMESTAMP'
        WHEN COALESCE(a.assigned_at, t.created_date) < DATE_SUB(NOW(), INTERVAL 15 DAY) THEN 'OUTSIDE_15_DAY_WINDOW'
        ELSE 'SHOULD_BE_VISIBLE_TO_ASSIGNEE'
    END AS notification_diagnosis
FROM hotel_operations t
LEFT JOIN `user` u ON u.guid = t.assigned_to
LEFT JOIN (
    SELECT company_code, operation_code, guid, MAX(created_date) AS assigned_at
    FROM hotel_checklist_logs
    WHERE type = 'task-assignment'
    GROUP BY company_code, operation_code, guid
) a ON a.company_code = t.company_code
    AND a.operation_code = t.operation_code AND a.guid = t.assigned_to
LEFT JOIN (
    SELECT company_code, operation_code, guid, COUNT(*) AS completed_rows
    FROM hotel_checklist_logs
    WHERE type = 'task' AND checklist = 1
    GROUP BY company_code, operation_code, guid
) c ON c.company_code = t.company_code
    AND c.operation_code = t.operation_code AND c.guid = t.assigned_to
WHERE t.id = 32;
