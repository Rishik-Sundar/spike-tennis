-- Spike Tennis — CameraController (StarterCharacterScripts)
-- Smooth third-person camera that stays behind the player and tilts toward the ball.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- Camera configuration
local CAM_DISTANCE = 22
local CAM_HEIGHT   = 12
local CAM_PITCH    = math.rad(-22)   -- look slightly downward
local LERP_SPEED   = 0.12
local BALL_TILT    = 0.25            -- how much camera tilts toward ball

local char
local root

-- Wait for character
player.CharacterAdded:Connect(function(c)
    char = c
    root = c:WaitForChild("HumanoidRootPart")
end)
char = player.Character
if char then root = char:FindFirstChild("HumanoidRootPart") end

camera.CameraType = Enum.CameraType.Scriptable

local currentCF = CFrame.new(0, CAM_HEIGHT, CAM_DISTANCE)

RunService.RenderStepped:Connect(function(dt)
    if not root then return end

    local ball = workspace:FindFirstChild("SpikeBall")
    local rPos = root.Position

    -- Base camera position: behind and above player, aligned with Z axis
    -- "Behind" means same Z direction the player faces (toward net)
    local playerFacing = root.CFrame.LookVector
    local camOffset = Vector3.new(
        rPos.X * 0.3,   -- slight X follow
        rPos.Y + CAM_HEIGHT,
        rPos.Z + (rPos.Z >= 0 and CAM_DISTANCE or -CAM_DISTANCE)
    )

    local lookTarget = Vector3.new(rPos.X, rPos.Y + 1.5, rPos.Z)

    -- Blend slightly toward ball if it exists
    if ball then
        local ballPos = ball.Position
        lookTarget = lookTarget:Lerp(
            Vector3.new(ballPos.X, ballPos.Y, ballPos.Z),
            BALL_TILT
        )
        -- Shift camera slightly horizontally to track ball
        camOffset = camOffset + Vector3.new((ballPos.X - rPos.X) * 0.15, 0, 0)
    end

    local targetCF = CFrame.lookAt(camOffset, lookTarget)

    currentCF = currentCF:Lerp(targetCF, LERP_SPEED)
    camera.CFrame = currentCF
end)
