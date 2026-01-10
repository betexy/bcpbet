if test -n "$(find runtime/logs/*.log -maxdepth 1 -print -quit 2>/dev/null)"; then
    rm runtime/logs/*.log
    echo "Logs cleared"
else
    echo "No logs to clear"
fi
if test -n "$(find runtime/logs/*.log.* -maxdepth 1 -print -quit 2>/dev/null)"; then
    rm runtime/logs/*.log.*
    echo "Logs archive cleared"
else
    echo "No logs archive to clear"
fi
