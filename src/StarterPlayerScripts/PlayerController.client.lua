-- Spike Tennis — PlayerController (client)
-- Handles WASD movement boost, swing input, aiming, and serve input.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Constants = require(ReplicatedStorage.Modules.Constants)
local C = Constants

local player = Players.LocalPlayer
local Remotes

local myIndex = 0
local canHit  = false
local isServing = false
local shotType  = "flat"

-- ─── Wait for remotes ────────────────────────────────────────────────────────
local function waitForRemotes()
    local remotesFolder = ReplicatedStorage:WaitForChild("Remotes", 20)
    if not remotesFolder then return end
    Remotes = {
        HitRequest   = remotesFolder:WaitForChild("HitRequest"),
        ServeRequest = remotesFolder:WaitForChild("ServeRequest"),
        PlayerAssign = remotesFolder:WaitForChild("PlayerAssign"),
        TimingInfo   = remotesFolder:WaitForChild("TimingInfo"),
        GameState    = remotesFolder:WaitForChild("GameState"),
    }
end

waitForRemotes()
if not Remotes then return end

-- ─── Player assignment ───────────────────────────────────────────────────────
Remotes.PlayerAssign.OnClientEvent:Connect(function(idx, spawnPos)
    myIndex = idx
    -- Teleport character to spawn
    local char = player.Character or player.CharacterAdded:Wait()
    local root = char:WaitForChild("HumanoidRootPart")
    root.CFrame = CFrame.new(spawnPos + Vector3.new(0, 3, 0))
    print("[PlayerController] Assigned as Player " .. idx)
end)

-- ─── Game state ──────────────────────────────────────────────────────────────
Remotes.GameState.OnClientEvent:Connect(function(newState, data)
    if newState == "Serving" then
        isServing = (data and data.server == myIndex)
        canHit = false
    elseif newState == "Rally" then
        isServing = false
        canHit = true
    elseif newState == "PointEnd" or newState == "Waiting" or newState == "MatchOver" then
        canHit = false
        isServing = false
    end
end)

Remotes.TimingInfo.OnClientEvent:Connect(function(infoType, pos)
    if infoType == "serve_ready" and myIndex ~= 0 then
        isServing = true
        canHit = false
    elseif infoType == "incoming" then
        canHit = true
    end
end)

-- ─── Speed boost ─────────────────────────────────────────────────────────────
local BASE_SPEED   = 20
local SPRINT_SPEED = 32

RunService.RenderStepped:Connect(function()
    local char = player.Character
    if not char then return end
    local hum = char:FindFirstChildOfClass("Humanoid")
    if not hum then return end

    local sprinting = UserInputService:IsKeyDown(Enum.KeyCode.LeftShift)
    hum.WalkSpeed = sprinting and SPRINT_SPEED or BASE_SPEED

    -- Auto-face ball when on court
    local ball = workspace:FindFirstChild("SpikeBall")
    local root = char:FindFirstChild("HumanoidRootPart")
    if ball and root and canHit then
        local ballDir = (ball.Position - root.Position)
        ballDir = Vector3.new(ballDir.X, 0, ballDir.Z)
        if ballDir.Magnitude > 1 then
            -- Gently rotate toward ball
            local targetCF = CFrame.lookAt(root.Position, root.Position + ballDir)
            root.CFrame = root.CFrame:Lerp(targetCF, 0.12)
        end
    end
end)

-- ─── Aim target calculation ──────────────────────────────────────────────────
local camera = workspace.CurrentCamera

local function getAimTarget()
    -- Raycast from screen center into world, aim for opponent court
    local unitRay = camera:ScreenPointToRay(
        camera.ViewportSize.X / 2,
        camera.ViewportSize.Y / 2
    )
    local raycastParams = RaycastParams.new()
    raycastParams.FilterType = Enum.RaycastFilterType.Exclude
    raycastParams.FilterDescendantsInstances = { player.Character }

    local result = workspace:Raycast(unitRay.Origin, unitRay.Direction * 200, raycastParams)
    if result then
        return result.Position
    end

    -- Fallback: aim to center of opponent court
    local oppZ = myIndex == 1 and -(C.COURT.HALF_LENGTH - 8) or (C.COURT.HALF_LENGTH - 8)
    return Vector3.new(0, 0, oppZ)
end

-- ─── Shot type selection ──────────────────────────────────────────────────────
-- Q = topspin, E = slice, R = lob, default = flat
UserInputService.InputBegan:Connect(function(input, gameProcessed)
    if gameProcessed then return end
    if input.KeyCode == Enum.KeyCode.Q then
        shotType = "topspin"
    elseif input.KeyCode == Enum.KeyCode.E then
        shotType = "slice"
    elseif input.KeyCode == Enum.KeyCode.R then
        shotType = "lob"
    elseif input.KeyCode == Enum.KeyCode.F then
        shotType = "smash"
    end
end)
UserInputService.InputEnded:Connect(function(input, gameProcessed)
    if input.KeyCode == Enum.KeyCode.Q or
       input.KeyCode == Enum.KeyCode.E or
       input.KeyCode == Enum.KeyCode.R or
       input.KeyCode == Enum.KeyCode.F then
        shotType = "flat"
    end
end)

-- ─── Hit / Serve input ───────────────────────────────────────────────────────
local hitThrottle = false

local function attemptHit()
    if hitThrottle then return end
    hitThrottle = true
    task.delay(0.35, function() hitThrottle = false end)

    if isServing then
        local target = getAimTarget()
        Remotes.ServeRequest:FireServer(target)
        isServing = false
    elseif canHit then
        local char = player.Character
        if not char then return end
        local root = char:FindFirstChild("HumanoidRootPart")
        local ball  = workspace:FindFirstChild("SpikeBall")
        if not root or not ball then return end

        local dist = (root.Position - ball.Position).Magnitude
        if dist > C.SHOTS.HIT_RANGE then return end

        local target = getAimTarget()
        Remotes.HitRequest:FireServer(target, shotType)

        -- Swing animation via character humanoid (trigger anim if available)
        local anim = char:FindFirstChild("Animate")
        if anim then
            local swingAnim = anim:FindFirstChild("swing")
            if swingAnim then swingAnim:Play() end
        end
    end
end

-- Left click or Space to hit
UserInputService.InputBegan:Connect(function(input, gameProcessed)
    if gameProcessed then return end
    if input.UserInputType == Enum.UserInputType.MouseButton1 or
       input.KeyCode == Enum.KeyCode.Space then
        attemptHit()
    end
end)

-- Mobile: tap anywhere to hit (TouchTap)
UserInputService.TouchTap:Connect(function(positions, gameProcessed)
    if gameProcessed then return end
    attemptHit()
end)

print("[PlayerController] Ready.")
