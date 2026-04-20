"""动态 (Post) module — 6 essential tools."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from .api_client import api_get, api_post


def register(mcp: FastMCP) -> None:

    @mcp.tool()
    def post_add_post(
        post_msg: str,
        group_ids: str | None = None,
    ) -> dict:
        """发布一条新动态到全公司或指定群组。group_ids 逗号分隔。"""
        return api_post("/v1/post/add_post",
                        post_msg=post_msg, post_type=0,
                        group_ids=group_ids)

    @mcp.tool()
    def post_add_post_reply(post_id: str, reply_msg: str, reply_id: str | None = None) -> dict:
        """给指定动态添加评论。reply_id 为回复某条评论时填写。"""
        return api_post("/v1/post/add_post_reply", post_id=post_id, reply_msg=reply_msg, reply_id=reply_id)

    @mcp.tool()
    def post_delete_post(post_id: str) -> dict:
        """删除一条动态。"""
        return api_post("/v1/post/delete_post", post_id=post_id)

    @mcp.tool()
    def post_get_all_posts(
        pagesize: int = 20,
        keywords: str | None = None,
        max_id: str | None = None,
    ) -> dict:
        """获取全公司可见的动态流。用 max_id 翻页。"""
        return api_get("/v1/post/get_all_posts",
                       pagesize=pagesize, keywords=keywords, max_id=max_id)

    @mcp.tool()
    def post_get_post_detail(post_id: str) -> dict:
        """获取单条动态的详细信息。"""
        return api_get("/v1/post/get_post_detail", post_id=post_id)

    @mcp.tool()
    def post_get_post_reply(post_id: str, pagesize: int = 20, max_id: str | None = None) -> dict:
        """获取某条动态的评论列表。"""
        return api_get("/v1/post/get_post_reply", post_id=post_id, pagesize=pagesize, max_id=max_id)
