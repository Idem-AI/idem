<?php

declare(strict_types=1);

namespace Laravel\Boost\Mcp\Methods;

use Illuminate\Support\ItemNotFoundException;
use Laravel\Boost\Mcp\ToolExecutor;
use Laravel\Mcp\Server\Contracts\Methods\Method;
use Laravel\Mcp\Server\ServerContext;
use Laravel\Mcp\Server\Tools\ToolResult;
use Laravel\Mcp\Server\Transport\JsonRpcRequest;
use Laravel\Mcp\Server\Transport\JsonRpcResponse;
use Throwable;

class CallToolWithExecutor implements Method
{
    /**
     * Handle the JSON-RPC tool/call request with process isolation.
     *
     * @param JsonRpcRequest $request
     * @param ServerContext $context
     * @return JsonRpcResponse
     */
    public function handle(JsonRpcRequest $request, ServerContext $context): JsonRpcResponse
    {
        try {
            $tool = $context->tools()->firstOrFail(fn ($tool) => $tool->name() === $request->params['name']);
        } catch (ItemNotFoundException) {
            return JsonRpcResponse::create(
                $request->id,
                ToolResult::error('Tool not found')
            );
        } catch (Throwable $e) {
            return JsonRpcResponse::create(
                $request->id,
                ToolResult::error('Error finding tool: '.$e->getMessage())
            );
        }

        try {
            $executor = app(ToolExecutor::class);

            $arguments = [];
            if (isset($request->params['arguments']) && is_array($request->params['arguments'])) {
                $arguments = $request->params['arguments'];
            }

            $result = $executor->execute(get_class($tool), $arguments);

            return JsonRpcResponse::create($request->id, $result);

        } catch (Throwable $e) {
            return JsonRpcResponse::create(
                $request->id,
                ToolResult::error('Tool execution error: '.$e->getMessage())
            );
        }
    }
}
