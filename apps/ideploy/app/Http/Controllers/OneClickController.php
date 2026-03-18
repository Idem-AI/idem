<?php

namespace App\Http\Controllers;

use App\Services\OneClickDeployService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class OneClickController extends Controller
{
    public function __construct(private OneClickDeployService $service) {}

    public function deploy(Request $request)
    {
        try {
            Log::info('One-Click Deploy initiated');

            $request->validate([
                'file' => 'required|file|mimes:zip|max:51200',
            ]);

            $user = auth()->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
            }

            $team = $user->currentTeam();
            $file = $request->file('file');
            $projectName = $request->input('project_name', 'appgen-' . time());

            $app = $this->service->deployFromZip($file, $team, $projectName);

            $fqdn = $app->fqdn ?? "{$app->uuid}.ideploy.africa";
            $url = "https://{$fqdn}";

            return response()->json([
                'success' => true,
                'url' => $url,
                'application_uuid' => $app->uuid,
            ]);

        } catch (\Exception $e) {
            Log::error('One-Click Deploy failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}
