package routes

import (
	"container/heap"
	"context"
	"math"

	"github.com/maitijit89/b-map-backend/pkg/utils"
)

// CHEdge represents a directed edge in the Contraction Hierarchy graph (including shortcut edges).
type CHEdge struct {
	ToNodeID    int64
	Weight      float64
	IsShortcut  bool
	MiddleNode  int64 // If shortcut, stores the contracted middle node ID for path unpacking
	ForwardOnly bool
}

// CHNode represents a node in the Contraction Hierarchy with its level rank.
type CHNode struct {
	ID        int64
	Location  utils.Coordinate
	Rank      int // Higher rank means contracted later (more important backbone roads)
	Forward   []CHEdge
	Backward  []CHEdge
}

// CHGraph is the Contraction Hierarchy graph data structure.
type CHGraph struct {
	Nodes map[int64]*CHNode
}

func NewCHGraph() *CHGraph {
	return &CHGraph{
		Nodes: make(map[int64]*CHNode),
	}
}

func (g *CHGraph) AddNode(id int64, loc utils.Coordinate, rank int) {
	g.Nodes[id] = &CHNode{
		ID:       id,
		Location: loc,
		Rank:     rank,
		Forward:  make([]CHEdge, 0),
		Backward: make([]CHEdge, 0),
	}
}

func (g *CHGraph) AddEdge(from, to int64, weight float64) {
	if nFrom, ok := g.Nodes[from]; ok {
		nFrom.Forward = append(nFrom.Forward, CHEdge{ToNodeID: to, Weight: weight})
	}
	if nTo, ok := g.Nodes[to]; ok {
		nTo.Backward = append(nTo.Backward, CHEdge{ToNodeID: from, Weight: weight})
	}
}

// AddShortcut adds a shortcut edge when contracting middleNode.
func (g *CHGraph) AddShortcut(from, to, middleNode int64, weight float64) {
	if nFrom, ok := g.Nodes[from]; ok {
		nFrom.Forward = append(nFrom.Forward, CHEdge{
			ToNodeID:   to,
			Weight:     weight,
			IsShortcut: true,
			MiddleNode: middleNode,
		})
	}
	if nTo, ok := g.Nodes[to]; ok {
		nTo.Backward = append(nTo.Backward, CHEdge{
			ToNodeID:   from,
			Weight:     weight,
			IsShortcut: true,
			MiddleNode: middleNode,
		})
	}
}

type chPQItem struct {
	nodeID   int64
	priority float64
	index    int
}

type chPriorityQueue []*chPQItem

func (pq chPriorityQueue) Len() int           { return len(pq) }
func (pq chPriorityQueue) Less(i, j int) bool { return pq[i].priority < pq[j].priority }
func (pq chPriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}
func (pq *chPriorityQueue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*chPQItem)
	item.index = n
	*pq = append(*pq, item)
}
func (pq *chPriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	item.index = -1
	*pq = old[0 : n-1]
	return item
}

// QueryCH executes bidirectional Dijkstra search on the Contraction Hierarchy (upward searches only).
func (g *CHGraph) QueryCH(ctx context.Context, sourceID, targetID int64) (float64, []int64) {
	if sourceID == targetID {
		return 0, []int64{sourceID}
	}

	distF := make(map[int64]float64)
	distB := make(map[int64]float64)
	parentF := make(map[int64]int64)
	parentB := make(map[int64]int64)

	pqF := &chPriorityQueue{}
	pqB := &chPriorityQueue{}
	heap.Init(pqF)
	heap.Init(pqB)

	distF[sourceID] = 0
	heap.Push(pqF, &chPQItem{nodeID: sourceID, priority: 0})

	distB[targetID] = 0
	heap.Push(pqB, &chPQItem{nodeID: targetID, priority: 0})

	bestDist := math.Inf(1)
	var meetingNode int64 = -1

	for pqF.Len() > 0 || pqB.Len() > 0 {
		// Forward search step (only to higher-ranked nodes)
		if pqF.Len() > 0 {
			currF := heap.Pop(pqF).(*chPQItem)
			u := currF.nodeID
			uNode := g.Nodes[u]

			if currF.priority > bestDist {
				// Optimization: upper bound reached
			} else {
				for _, edge := range uNode.Forward {
					vNode := g.Nodes[edge.ToNodeID]
					if vNode.Rank > uNode.Rank { // Upward search restriction
						alt := distF[u] + edge.Weight
						if d, exists := distF[edge.ToNodeID]; !exists || alt < d {
							distF[edge.ToNodeID] = alt
							parentF[edge.ToNodeID] = u
							heap.Push(pqF, &chPQItem{nodeID: edge.ToNodeID, priority: alt})

							if dBack, bExists := distB[edge.ToNodeID]; bExists && alt+dBack < bestDist {
								bestDist = alt + dBack
								meetingNode = edge.ToNodeID
							}
						}
					}
				}
			}
		}

		// Backward search step (only to higher-ranked nodes)
		if pqB.Len() > 0 {
			currB := heap.Pop(pqB).(*chPQItem)
			u := currB.nodeID
			uNode := g.Nodes[u]

			if currB.priority > bestDist {
				// Optimization: upper bound reached
			} else {
				for _, edge := range uNode.Backward {
					vNode := g.Nodes[edge.ToNodeID]
					if vNode.Rank > uNode.Rank { // Upward search restriction
						alt := distB[u] + edge.Weight
						if d, exists := distB[edge.ToNodeID]; !exists || alt < d {
							distB[edge.ToNodeID] = alt
							parentB[edge.ToNodeID] = u
							heap.Push(pqB, &chPQItem{nodeID: edge.ToNodeID, priority: alt})

							if dForw, fExists := distF[edge.ToNodeID]; fExists && alt+dForw < bestDist {
								bestDist = alt + dForw
								meetingNode = edge.ToNodeID
							}
						}
					}
				}
			}
		}
	}

	if meetingNode == -1 || math.IsInf(bestDist, 1) {
		return math.Inf(1), nil
	}

	// Reconstruct path through meeting node
	var pathF []int64
	curr := meetingNode
	for curr != sourceID {
		pathF = append([]int64{curr}, pathF...)
		curr = parentF[curr]
	}
	pathF = append([]int64{sourceID}, pathF...)

	var pathB []int64
	curr = meetingNode
	for curr != targetID {
		next := parentB[curr]
		pathB = append(pathB, next)
		curr = next
	}

	fullPath := append(pathF, pathB...)
	return bestDist, fullPath
}
