package routes

import (
	"container/heap"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

// GraphNode represents a node in the routing graph
type GraphNode struct {
	ID        int64
	Latitude  float64
	Longitude float64
	Neighbors []GraphEdge
}

// GraphEdge represents a directed connection between two nodes
type GraphEdge struct {
	TargetNodeID int64
	LengthMeters float64
	MaxSpeedKmh  float64
	RoadName     string
	RoadType     string
}

type item struct {
	nodeID   int64
	priority float64 // f(n) = g(n) + h(n)
	index    int
}

type priorityQueue []*item

func (pq priorityQueue) Len() int           { return len(pq) }
func (pq priorityQueue) Less(i, j int) bool { return pq[i].priority < pq[j].priority }
func (pq priorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}
func (pq *priorityQueue) Push(x interface{}) {
	n := len(*pq)
	it := x.(*item)
	it.index = n
	*pq = append(*pq, it)
}
func (pq *priorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	it := old[n-1]
	old[n-1] = nil
	it.index = -1
	*pq = old[0 : n-1]
	return it
}

// AStarSearch finds the shortest path between startNodeID and targetNodeID on an in-memory road graph.
func AStarSearch(nodes map[int64]*GraphNode, startNodeID, targetNodeID int64) ([]int64, float64, bool) {
	targetNode, exists := nodes[targetNodeID]
	if !exists {
		return nil, 0, false
	}
	startNode, exists := nodes[startNodeID]
	if !exists {
		return nil, 0, false
	}

	gScore := make(map[int64]float64)
	fScore := make(map[int64]float64)
	cameFrom := make(map[int64]int64)

	for id := range nodes {
		gScore[id] = math.Inf(1)
		fScore[id] = math.Inf(1)
	}

	gScore[startNodeID] = 0
	hInitial := utils.HaversineDistance(startNode.Latitude, startNode.Longitude, targetNode.Latitude, targetNode.Longitude)
	fScore[startNodeID] = hInitial

	pq := make(priorityQueue, 0)
	heap.Init(&pq)
	heap.Push(&pq, &item{nodeID: startNodeID, priority: hInitial})

	visited := make(map[int64]bool)

	for pq.Len() > 0 {
		current := heap.Pop(&pq).(*item)
		currID := current.nodeID

		if currID == targetNodeID {
			// Reconstruct path
			path := []int64{currID}
			for prev, ok := cameFrom[currID]; ok; prev, ok = cameFrom[currID] {
				currID = prev
				path = append([]int64{currID}, path...)
			}
			return path, gScore[targetNodeID], true
		}

		visited[currID] = true
		currNode := nodes[currID]
		if currNode == nil {
			continue
		}

		for _, edge := range currNode.Neighbors {
			neighborID := edge.TargetNodeID
			if visited[neighborID] {
				continue
			}

			tentativeGScore := gScore[currID] + edge.LengthMeters
			if tentativeGScore < gScore[neighborID] {
				cameFrom[neighborID] = currID
				gScore[neighborID] = tentativeGScore

				neighborNode := nodes[neighborID]
				if neighborNode != nil {
					h := utils.HaversineDistance(neighborNode.Latitude, neighborNode.Longitude, targetNode.Latitude, targetNode.Longitude)
					fScore[neighborID] = tentativeGScore + h
					heap.Push(&pq, &item{nodeID: neighborID, priority: fScore[neighborID]})
				}
			}
		}
	}

	return nil, 0, false
}
