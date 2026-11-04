from pathlib import Path
p=Path(r'C:\inetpub\wwwroot\workspace\common\models\Timesheet.php')
text=p.read_text(encoding='utf-8-sig')
old="""        if ($end <= $start) {
            $end = strtotime('+1 day', $end);
        }

        $minutes = (int)floor(($end - $start) / 60);"""
new="""        // These are full UTC datetimes, not time-of-day values. A genuine
        // overnight shift already has the following date in end_time. Equal,
        // reversed or future running timestamps must not manufacture a day.
        if ($start === false || $end === false || $end <= $start) {
            return 0;
        }

        $minutes = (int)floor(($end - $start) / 60);"""
assert old in text
text=text.replace(old,new)
old="""        return max(0, $minutes);
    }

    public function isBreakActive()"""
new="""        // Completed breaks are already in break_minutes. Deduct only the
        // currently open break here, without mutating any persisted totals.
        // Match TimesheetController::endActiveBreak's round-up convention.
        if (empty($this->end_time) && $this->isBreakActive()) {
            $breakStart = self::utcTimestamp($this->break_start_time);
            if ($breakStart !== false && $breakStart < $end) {
                $minutes -= (int)ceil(($end - max($start, $breakStart)) / 60);
            }
        }

        return max(0, $minutes);
    }

    public function isBreakActive()"""
assert old in text
p.write_text(text.replace(old,new),encoding='utf-8')
print('Updated Timesheet duration calculation in workspace.')
