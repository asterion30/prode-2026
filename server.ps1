$path = "c:\Users\rortega\OneDrive - SOCORRO MEDICO PRIVADO S A\Escritorio\Gemini\Prode"
$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
  $listener.Start()
  Write-Host "Servidor Web de Antigravity iniciado en http://localhost:$port/"
} catch {
  Write-Host "Error iniciando el servidor: $_"
  exit
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $response = $context.Response
        $request = $context.Request
        
        $reqPath = $request.Url.LocalPath.TrimStart('/')
        if ($reqPath -eq "") { $reqPath = "index.html" }
        
        # Security: basic check to prevent directory traversal
        if ($reqPath -match "\.\.") {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        $fullPath = Join-Path $path $reqPath
        
        if (Test-Path $fullPath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentLength64 = $content.Length
            
            $ext = [System.IO.Path]::GetExtension($fullPath)
            switch ($ext) {
                ".html" { $response.ContentType = "text/html" }
                ".js"   { $response.ContentType = "application/javascript" }
                ".css"  { $response.ContentType = "text/css" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".json" { $response.ContentType = "application/json" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
        # ignore context errors
    }
}
