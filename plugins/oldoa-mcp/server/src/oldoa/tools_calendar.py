"""日程 (Calendar) module — 10 essential tools.

NOTE: /v1/calendar/get_events_by_conditions is broken server-side, so
calendar_get_events fetches the iCal subscription feed and parses it.
"""

from __future__ import annotations

import re
import urllib.request
from datetime import datetime, timedelta, timezone

from mcp.server.fastmcp import FastMCP

from .api_client import api_get, api_post

_CST = timezone(timedelta(hours=8))


def _parse_ical_events(ical_text: str,
                       start_filter: str | None = None,
                       end_filter: str | None = None) -> list[dict]:
    if start_filter:
        filter_start = datetime.strptime(start_filter, "%Y-%m-%d").replace(tzinfo=_CST)
    else:
        filter_start = None
    if end_filter:
        filter_end = datetime.strptime(end_filter, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=_CST)
    else:
        filter_end = None

    def _get(block: str, name: str) -> str:
        m = re.search(rf'^{name}[;:](.*)$', block, re.MULTILINE)
        return m.group(1).strip() if m else ""

    def _parse_dt(raw: str) -> datetime | None:
        s = raw.replace("Z", "")
        try:
            if "T" in s:
                dt = datetime.strptime(s, "%Y%m%dT%H%M%S")
                if raw.endswith("Z"):
                    dt = dt.replace(tzinfo=timezone.utc).astimezone(_CST)
                else:
                    dt = dt.replace(tzinfo=_CST)
            else:
                dt = datetime.strptime(s, "%Y%m%d").replace(tzinfo=_CST)
            return dt
        except ValueError:
            return None

    results: list[dict] = []
    for m in re.finditer(r"BEGIN:VEVENT(.*?)END:VEVENT", ical_text, re.DOTALL):
        block = m.group(1)
        dt_start = _parse_dt(_get(block, "DTSTART"))
        if dt_start is None:
            continue
        if filter_start and dt_start < filter_start:
            continue
        if filter_end and dt_start > filter_end:
            continue

        dt_end = _parse_dt(_get(block, "DTEND"))
        summary = _get(block, "SUMMARY")
        description = _get(block, "DESCRIPTION")
        location = _get(block, "LOCATION")
        uid = _get(block, "UID")
        organizer = _get(block, "ORGANIZER")
        if "MAILTO:" in organizer:
            organizer = organizer.split("MAILTO:")[-1]

        results.append({
            "event_id": uid,
            "summary": summary,
            "start_time": dt_start.strftime("%Y-%m-%d %H:%M"),
            "end_time": dt_end.strftime("%Y-%m-%d %H:%M") if dt_end else "",
            "location": location,
            "description": description[:500] if description else "",
            "organizer": organizer,
        })

    results.sort(key=lambda e: e["start_time"])
    return results


def register(mcp: FastMCP) -> None:

    @mcp.tool()
    def calendar_get_events(
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict:
        """获取日程列表。通过日历订阅接口拉取 iCal 数据并解析。

        日期格式 YYYY-MM-DD，用于过滤日程范围（北京时间）。
        不传日期则返回所有日程。
        """
        resp = api_get("/v1/calendar/get_calendar_subscription_url")
        if not resp.get("success"):
            return resp
        sub_url = resp.get("data", {}).get("subscription_url", "")
        if not sub_url:
            return {"success": False, "error_msg": "无法获取日历订阅地址"}

        req = urllib.request.Request(sub_url, method="GET",
                                     headers={"User-Agent": "oldoa/0.1"})
        with urllib.request.urlopen(req, timeout=60) as r:
            ical_text = r.read().decode("utf-8")

        events = _parse_ical_events(ical_text, start_date, end_date)
        return {"data": events, "count": len(events), "success": True, "error_code": 1}

    @mcp.tool()
    def calendar_get_event_details(event_id: str) -> dict:
        """获取单个日程的详细信息。"""
        return api_get("/v1/calendar/get_event_details", event_id=event_id)

    @mcp.tool()
    def calendar_get_unconfirmed_events(page_index: int = 1, page_size: int = 20) -> dict:
        """获取当前用户未确认的日程邀请。"""
        return api_get("/v1/calendar/get_unconfirmed_events", page_index=page_index, page_size=page_size)

    @mcp.tool()
    def calendar_search(keyword: str, begin_date: str | None = None, end_date: str | None = None) -> dict:
        """按关键词搜索日程。begin_date/end_date 格式 YYYY-MM-DD。"""
        return api_get("/v1/calendar/search_events_by_keyword",
                       keyword=keyword, begin_date=begin_date, end_date=end_date)

    @mcp.tool()
    def calendar_create_event(
        name: str,
        begin_date: str,
        end_date: str,
        address: str | None = None,
        event_description: str | None = None,
        is_all_day_event: bool | None = None,
        member_ids: str | None = None,
        is_recurring_event: bool | None = None,
        repeat_frequency: int | None = None,
        repeat_interval: int | None = None,
        repeat_times: int | None = None,
    ) -> dict:
        """创建日程。member_ids 逗号分隔用户ID。循环：repeat_frequency 1=日 2=周 3=月 4=年，repeat_interval 间隔数，repeat_times 次数。"""
        return api_post("/v1/calendar/create_event",
                        name=name, begin_date=begin_date, end_date=end_date,
                        address=address, event_description=event_description,
                        is_all_day_event=is_all_day_event, member_ids=member_ids,
                        is_recurring_event=is_recurring_event,
                        repeat_frequency=repeat_frequency,
                        repeat_interval=repeat_interval, repeat_times=repeat_times)

    @mcp.tool()
    def calendar_edit_event(
        event_id: str,
        name: str | None = None,
        begin_date: str | None = None,
        end_date: str | None = None,
        address: str | None = None,
        event_description: str | None = None,
        is_all_day_event: bool | None = None,
        repeat_frequency: int | None = None,
        repeat_interval: int | None = None,
        repeat_times: int | None = None,
        repeat_end_date: str | None = None,
        modifying_all_recurring_events: bool | None = None,
        event_recurring_time: str | None = None,
    ) -> dict:
        """修改日程。改循环日程时：modifying_all_recurring_events=True 改全部，否则配 event_recurring_time 改单次。"""
        return api_post("/v1/calendar/edit_common_properties_on_event",
                        event_id=event_id, name=name,
                        begin_date=begin_date, end_date=end_date,
                        address=address, event_description=event_description,
                        is_all_day_event=is_all_day_event,
                        repeat_frequency=repeat_frequency, repeat_interval=repeat_interval,
                        repeat_times=repeat_times, repeat_end_date=repeat_end_date,
                        modifying_all_recurring_events=modifying_all_recurring_events,
                        event_recurring_time=event_recurring_time)

    @mcp.tool()
    def calendar_remove_event(event_id: str, removing_all_recurring_events: str = "false",
                               event_recurring_time: str | None = None) -> dict:
        """删除日程。removing_all_recurring_events: 是否删除所有循环日程。"""
        return api_post("/v1/calendar/remove_event", event_id=event_id,
                        removing_all_recurring_events=removing_all_recurring_events,
                        event_recurring_time=event_recurring_time)

    @mcp.tool()
    def calendar_add_members(
        event_id: str,
        member_ids: str | None = None,
        invited_accounts: str | None = None,
        event_recurring_time: str | None = None,
        modifying_all_recurring_events: bool | None = None,
    ) -> dict:
        """给日程添加成员。member_ids 逗号分隔（明道用户），invited_accounts 为非明道用户（格式 ["电话","邮箱"]）。"""
        return api_post("/v1/calendar/add_members_to_event",
                        event_id=event_id, member_ids=member_ids,
                        invited_accounts=invited_accounts,
                        event_recurring_time=event_recurring_time,
                        modifying_all_recurring_events=modifying_all_recurring_events)

    @mcp.tool()
    def calendar_remove_member(event_id: str, member_id: str | None = None,
                                event_recurring_time: str | None = None,
                                modifying_all_recurring_events: str | None = None,
                                third_party_user_id: str | None = None) -> dict:
        """从日程中移除某成员。"""
        return api_post("/v1/calendar/remove_a_member_on_event",
                        event_id=event_id, member_id=member_id,
                        event_recurring_time=event_recurring_time,
                        modifying_all_recurring_events=modifying_all_recurring_events,
                        third_party_user_id=third_party_user_id)

    @mcp.tool()
    def calendar_confirm_invitation(event_id: str, event_recurring_time: str | None = None) -> dict:
        """确认日程邀请。"""
        return api_post("/v1/calendar/confirm_event_invitation",
                        event_id=event_id, event_recurring_time=event_recurring_time)
