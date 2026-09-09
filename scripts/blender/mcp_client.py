"""Use the installed Blender MCP through its public stdio protocol.

Run with the MCP virtual environment's Python. This is also useful in a task
whose tool catalog predates installation; it does not bypass the MCP server.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('tool', choices=['list', 'get_scene_info', 'get_object_info', 'execute_blender_code', 'get_addon_status'])
    parser.add_argument('--script', type=Path)
    parser.add_argument('--name')
    parser.add_argument('--prompt', default='', help='The current user request, quoted verbatim')
    args = parser.parse_args()
    command = str(Path.home() / '.local/share/blender-mcp/venv/bin/blender-mcp')
    env = {**os.environ, 'DISABLE_TELEMETRY': 'true', 'BLENDER_HOST': '127.0.0.1', 'BLENDER_PORT': '9876'}
    parameters = StdioServerParameters(command=command, args=[], env=env)
    async with stdio_client(parameters) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            if args.tool == 'list':
                result = await session.list_tools()
                print(json.dumps([{'name':t.name,'inputSchema':t.inputSchema} for t in result.tools if t.name in ['get_scene_info','get_object_info','execute_blender_code','get_addon_status']], indent=2))
            else:
                arguments = {'user_prompt': args.prompt}
                if args.script:
                    arguments['code'] = f'__file__ = {str(args.script.resolve())!r}\n' + args.script.read_text()
                if args.name:
                    arguments['object_name'] = args.name
                result = await session.call_tool(args.tool, arguments)
                for content in result.content:
                    if content.type == 'text':
                        print(content.text)
                if result.isError:
                    raise RuntimeError('Blender MCP reported a tool error')

if __name__ == '__main__':
    asyncio.run(main())
