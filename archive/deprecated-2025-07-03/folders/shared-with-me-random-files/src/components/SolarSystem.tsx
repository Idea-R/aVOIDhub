import React, { useState, useEffect, useRef } from 'react';
    import Blob from './Blob';

    // Constants for physics simulation
    const GRAVITATIONAL_CONSTANT = 0.0005; // Gravitational constant
    const SUN_MASS = 10000; // Mass of the central "sun"
    const TIME_STEP = 0.02; // Time step for simulation
    const MIN_DISTANCE_SQ = 100; // Minimum squared distance to avoid extreme forces in gravity
    const BOUNCE_DAMPING = 0.8; // Factor to reduce velocity on edge bounce

    // Collision constants
    const COLLISION_DAMPING = 0.9; // Factor to reduce velocity on blob collision
    const CHIP_PERCENTAGE = 0.05; // Percentage of size/mass lost on collision (5%)
    const MIN_BLOB_SIZE = 10; // Minimum size before a blob is removed

    interface BlobData {
      id: number;
      size: number; // Diameter of the blob
      color: string;
      mass: number; // Mass of the blob
      position: { x: number; y: number }; // Current position relative to container center
      velocity: { x: number; y: number }; // Current velocity
      isDragging: boolean;
      dragOffset: { x: number; y: number } | null; // Offset from mouse to blob center when dragging
      initialPosition: { x: number; y: number } | null; // Store position when drag starts
      dragStartTime: number | null; // Store timestamp when drag starts
    }

    const SolarSystem: React.FC = () => {
      const containerRef = useRef<HTMLDivElement>(null);
      const [blobs, setBlobs] = useState<BlobData[]>(() => {
        // Initial positions and velocities for a somewhat stable orbit
        const initialBlobs: Omit<BlobData, 'isDragging' | 'dragOffset' | 'initialPosition' | 'dragStartTime'>[] = [
          { id: 1, size: 40, color: '#FF6B6B', mass: 10, position: { x: 150, y: 0 }, velocity: { x: 0, y: 0.2 } }, // Further out, slightly slower
          { id: 2, size: 30, color: '#4ECDC4', mass: 5, position: { x: -200, y: 0 }, velocity: { x: 0, y: -0.18 } }, // Further out, slightly slower
          { id: 3, size: 50, color: '#45B7D1', mass: 15, position: { x: 0, y: 100 }, velocity: { x: -0.3, y: 0 } }, // Closer in, faster
          { id: 4, size: 25, color: '#F7FFF7', mass: 3, position: { x: 0, y: -250 }, velocity: { x: 0.15, y: 0 } }, // Further out
          { id: 5, size: 35, color: '#A7DBDB', mass: 7, position: { x: 200, y: 200 }, velocity: { x: -0.15, y: 0.08 } }, // Diagonal position
        ];

        return initialBlobs.map(blob => ({
          ...blob,
          isDragging: false,
          dragOffset: null,
          initialPosition: null, // Initialize new fields
          dragStartTime: null, // Initialize new fields
        }));
      });

      // Physics simulation loop
      useEffect(() => {
        let animationFrameId: number;

        const animate = () => {
          setBlobs(prevBlobs => {
            const container = containerRef.current;
            if (!container) return prevBlobs; // Don't animate if container isn't ready

            const containerRect = container.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const containerHeight = containerRect.height;

            // Create a mutable copy of blobs for updates within the loop
            let currentBlobs = prevBlobs.map(blob => ({ ...blob }));

            // --- Apply Gravity Forces ---
            currentBlobs = currentBlobs.map(blob => {
              if (blob.isDragging) {
                // If dragging, position is handled by mouse events, velocity is zero
                return { ...blob, velocity: { x: 0, y: 0 } };
              } else {
                let totalForceX = 0;
                let totalForceY = 0;

                // Add force from the central "sun"
                const sunDx = -blob.position.x;
                const sunDy = -blob.position.y;
                const sunDistanceSq = sunDx * sunDx + sunDy * sunDy;
                const safeSunDistanceSq = Math.max(sunDistanceSq, MIN_DISTANCE_SQ);
                const sunDistance = Math.sqrt(safeSunDistanceSq);
                const sunForceMagnitude = (GRAVITATIONAL_CONSTANT * SUN_MASS * blob.mass) / safeSunDistanceSq;
                totalForceX += sunForceMagnitude * (sunDx / sunDistance);
                totalForceY += sunForceMagnitude * (sunDy / sunDistance);

                // Add forces from other blobs (N-body gravity)
                currentBlobs.forEach(otherBlob => {
                  if (blob.id !== otherBlob.id) { // Don't calculate force of blob on itself
                    const otherDx = otherBlob.position.x - blob.position.x; // Vector from blob to other blob
                    const otherDy = otherBlob.position.y - blob.position.y;
                    const otherDistanceSq = otherDx * otherDx + otherDy * otherDy;

                    // Use minimum distance squared to avoid extreme forces when very close
                    // Also add a small epsilon to prevent division by zero if blobs are exactly on top of each other
                    const safeOtherDistanceSq = Math.max(otherDistanceSq, MIN_DISTANCE_SQ, 1e-6);
                    const otherDistance = Math.sqrt(safeOtherDistanceSq);

                    // Calculate force magnitude (F = G * m1 * m2 / r^2)
                    const otherForceMagnitude = (GRAVITATIONAL_CONSTANT * otherBlob.mass * blob.mass) / safeOtherDistanceSq;

                    // Calculate force components (F_x = F * dx/distance, F_y = F * dy/distance)
                    // Note: Force is attractive, so direction is towards the other blob
                    totalForceX += otherForceMagnitude * (otherDx / otherDistance);
                    totalForceY += otherForceMagnitude * (otherDy / otherDistance);
                  }
                });

                // Calculate acceleration (a = F / m)
                const accelerationX = totalForceX / blob.mass;
                const accelerationY = totalForceY / blob.mass;

                // Update velocity (v = v + a * dt)
                let newVelocityX = blob.velocity.x + accelerationX * TIME_STEP;
                let newVelocityY = blob.velocity.y + accelerationY * TIME_STEP;

                // Update position (p = p + v * dt)
                let newPositionX = blob.position.x + newVelocityX * TIME_STEP;
                let newPositionY = blob.position.y + newVelocityY * TIME_STEP;

                return {
                  ...blob,
                  position: { x: newPositionX, y: newPositionY },
                  velocity: { x: newVelocityX, y: newVelocityY },
                };
              }
            });

            // --- Check and Resolve Collisions ---
            const collidedPairs = new Set<string>(); // Keep track of pairs already processed

            for (let i = 0; i < currentBlobs.length; i++) {
              for (let j = i + 1; j < currentBlobs.length; j++) {
                const blobA = currentBlobs[i];
                const blobB = currentBlobs[j];

                // Skip if either blob is being dragged
                if (blobA.isDragging || blobB.isDragging) continue;

                // Generate a unique key for the pair regardless of order
                const pairKey = `${Math.min(blobA.id, blobB.id)}-${Math.max(blobA.id, blobB.id)}`;
                if (collidedPairs.has(pairKey)) continue; // Skip if already processed

                const dx = blobB.position.x - blobA.position.x;
                const dy = blobB.position.y - blobA.position.y;
                const distanceSq = dx * dx + dy * dy;
                const minDistance = (blobA.size / 2) + (blobB.size / 2);
                const minDistanceSq = minDistance * minDistance;

                // Collision detected
                if (distanceSq < minDistanceSq) {
                  collidedPairs.add(pairKey); // Mark pair as processed

                  // --- Collision Response (Simplified Chipping & Repulsion) ---

                  // Calculate overlap distance
                  const distance = Math.sqrt(distanceSq);
                  const overlap = minDistance - distance;

                  // Normalize collision vector
                  const nx = dx / distance;
                  const ny = dy / distance;

                  // Separate blobs slightly to prevent sticking (optional but helps stability)
                  // Move each blob away from the collision point by half the overlap
                  const separationFactor = 0.5; // Adjust as needed
                  blobA.position.x -= nx * overlap * separationFactor;
                  blobA.position.y -= ny * overlap * separationFactor;
                  blobB.position.x += nx * overlap * separationFactor;
                  blobB.position.y += ny * overlap * separationFactor;


                  // Calculate relative velocity
                  const relativeVelocityX = blobB.velocity.x - blobA.velocity.x;
                  const relativeVelocityY = blobB.velocity.y - blobA.velocity.y;

                  // Calculate velocity along the collision normal
                  const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

                  // Do not resolve if velocities are separating
                  if (velocityAlongNormal > 0) continue;

                  // Calculate impulse scalar (simplified)
                  // Using a simple repulsion based on the collision vector
                  const repulsionMagnitude = Math.abs(velocityAlongNormal) * COLLISION_DAMPING; // Scale by velocity and damping

                  const impulseX = nx * repulsionMagnitude;
                  const impulseY = ny * repulsionMagnitude;

                  // Apply impulse (adjust velocities)
                  // Simple repulsion: push blobs away from each other
                  blobA.velocity.x -= impulseX;
                  blobA.velocity.y -= impulseY;
                  blobB.velocity.x += impulseX;
                  blobB.velocity.y += impulseY;


                  // --- Chipping Effect (Reduce size and mass) ---
                  const chipAmountA = blobA.size * CHIP_PERCENTAGE;
                  const chipAmountB = blobB.size * CHIP_PERCENTAGE;

                  blobA.size = Math.max(MIN_BLOB_SIZE, blobA.size - chipAmountA);
                  blobB.size = Math.max(MIN_BLOB_SIZE, blobB.size - chipAmountB);

                  // Assume mass is proportional to size (or size squared/cubed, but proportional is simplest)
                  // Reduce mass proportionally to size reduction
                  const massReductionFactorA = chipAmountA / (blobA.size + chipAmountA); // (Original Size - New Size) / Original Size
                  const massReductionFactorB = chipAmountB / (blobB.size + chipAmountB);

                  blobA.mass = Math.max(0.1, blobA.mass * (1 - massReductionFactorA)); // Ensure mass doesn't go to zero
                  blobB.mass = Math.max(0.1, blobB.mass * (1 - massReductionFactorB));

                }
              }
            }

            // --- Edge Bouncing Logic ---
            currentBlobs = currentBlobs.map(blob => {
              if (blob.isDragging) return blob; // Skip if dragging

              let newPositionX = blob.position.x;
              let newPositionY = blob.position.y;
              let newVelocityX = blob.velocity.x;
              let newVelocityY = blob.velocity.y;

              const halfBlobSize = blob.size / 2;
              const maxX = containerWidth / 2 - halfBlobSize;
              const minX = -containerWidth / 2 + halfBlobSize;
              const maxY = containerHeight / 2 - halfBlobSize;
              const minY = -containerHeight / 2 + halfBlobSize;

              // Check horizontal bounds
              if (newPositionX > maxX) {
                newPositionX = maxX; // Correct position
                newVelocityX = -Math.abs(newVelocityX) * BOUNCE_DAMPING; // Reverse and dampen velocity
              } else if (newPositionX < minX) {
                newPositionX = minX; // Correct position
                newVelocityX = Math.abs(newVelocityX) * BOUNCE_DAMPING; // Reverse and dampen velocity
              }

              // Check vertical bounds
              if (newPositionY > maxY) {
                newPositionY = maxY; // Correct position
                newVelocityY = -Math.abs(newVelocityY) * BOUNCE_DAMPING; // Reverse and dampen velocity
              } else if (newPositionY < minY) {
                newPositionY = minY; // Correct position
                newVelocityY = Math.abs(newVelocityY) * BOUNCE_DAMPING; // Reverse and dampen velocity
              }

              return {
                ...blob,
                position: { x: newPositionX, y: newPositionY },
                velocity: { x: newVelocityX, y: newVelocityY },
              };
            });
            // --- End Edge Bouncing Logic ---

            // Filter out blobs that are too small
            const finalBlobs = currentBlobs.filter(blob => blob.size >= MIN_BLOB_SIZE);


            return finalBlobs;
          });
          animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameId);
      }, []); // Empty dependency array means this effect runs once on mount

      // Mouse event handlers for dragging
      const handleMouseDown = (e: React.MouseEvent, blobId: number) => {
        e.preventDefault(); // Prevent default drag behavior (like image dragging)

        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        const blob = blobs.find(b => b.id === blobId);
        if (!blob) return;

        // Mouse position relative to the center of the container
        const mouseX = e.clientX - (containerRect.left + containerRect.width / 2);
        const mouseY = e.clientY - (containerRect.top + containerRect.height / 2);

        // Offset from mouse position to the blob's current center position
        const offsetX = mouseX - blob.position.x;
        const offsetY = mouseY - blob.position.y;

        setBlobs(prevBlobs =>
          prevBlobs.map(b =>
            b.id === blobId ? {
              ...b,
              isDragging: true,
              dragOffset: { x: offsetX, y: offsetY },
              initialPosition: { ...b.position }, // Store initial position
              dragStartTime: performance.now(), // Store start time
            } : b
          )
        );

        // Add global listeners for mouse move and up
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      };

      const handleMouseMove = (e: MouseEvent) => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        setBlobs(prevBlobs =>
          prevBlobs.map(blob => {
            if (!blob.isDragging || !blob.dragOffset) return blob;

            // Current mouse position relative to the center of the container
            const mouseX = e.clientX - (containerRect.left + containerRect.width / 2);
            const mouseY = e.clientY - (containerRect.top + containerRect.height / 2);

            // Calculate new blob position based on mouse position and initial offset
            const newX = mouseX - blob.dragOffset.x;
            const newY = mouseY - blob.dragOffset.y;

            return {
              ...blob,
              position: { x: newX, y: newY },
            };
          })
        );
      };

      const handleMouseUp = () => {
        setBlobs(prevBlobs =>
          prevBlobs.map(blob => {
            if (!blob.isDragging || !blob.initialPosition || blob.dragStartTime === null) return blob;

            const dragDuration = performance.now() - blob.dragStartTime;

            // Calculate total displacement during the drag
            const totalDx = blob.position.x - blob.initialPosition.x;
            const totalDy = blob.position.y - blob.initialPosition.y;

            let finalVelocityX = 0;
            let finalVelocityY = 0;

            // Calculate velocity only if there was movement and duration is not zero
            if (dragDuration > 0) {
               // Calculate velocity based on total displacement and duration
              finalVelocityX = totalDx / (dragDuration / 1000); // Convert duration to seconds
              finalVelocityY = totalDy / (dragDuration / 1000); // Convert duration to seconds

              // Scale the velocity for the "sling shot" effect
              const SLINGSHOT_SCALE = 0.5; // Adjusted scale - experiment with this value
              finalVelocityX *= SLINGSHOT_SCALE;
              finalVelocityY *= SLINGSHOT_SCALE;
            }


            return {
              ...blob,
              isDragging: false,
              dragOffset: null,
              initialPosition: null, // Reset initial position
              dragStartTime: null, // Reset start time
              velocity: { x: finalVelocityX, y: finalVelocityY }, // Apply calculated velocity
            };
          })
        );

        // Remove global listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      // Clean up global listeners on component unmount
      useEffect(() => {
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };
      }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

      return (
        <div
          ref={containerRef}
          className="relative w-full h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black overflow-hidden"
        >
          {/* Center "Sun" blob */}
          <div
            className="absolute rounded-full bg-yellow-400"
            style={{
              width: '80px',
              height: '80px',
              filter: 'blur(20px)',
              zIndex: 2,
              left: '50%',
              top: '50%',
              marginLeft: '-40px', // Adjust for size
              marginTop: '-40px', // Adjust for size
            }}
          ></div>

          {/* Orbiting/Draggable blobs */}
          {blobs.map(blob => (
            <Blob
              key={blob.id}
              size={blob.size}
              color={blob.color}
              position={blob.position}
              onMouseDown={(e) => handleMouseDown(e, blob.id)}
            />
          ))}
        </div>
      );
    };

    export default SolarSystem;
