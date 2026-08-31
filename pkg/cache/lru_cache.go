package cache

import (
	"container/list"
	"sync"
	"time"
)

type cacheItem struct {
	key       string
	value     interface{}
	expiresAt time.Time
}

type LRUCache struct {
	mu       sync.RWMutex
	capacity int
	ttl      time.Duration
	items    map[string]*list.Element
	evictList *list.List
	hits     int64
	misses   int64
}

func NewLRUCache(capacity int, defaultTTL time.Duration) *LRUCache {
	if capacity <= 0 {
		capacity = 5000
	}
	if defaultTTL <= 0 {
		defaultTTL = 10 * time.Minute
	}
	return &LRUCache{
		capacity:  capacity,
		ttl:       defaultTTL,
		items:     make(map[string]*list.Element),
		evictList: list.New(),
	}
}

func (c *LRUCache) Get(key string) (interface{}, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		item := elem.Value.(*cacheItem)
		if time.Now().After(item.expiresAt) {
			c.removeElement(elem)
			c.misses++
			return nil, false
		}
		c.evictList.MoveToFront(elem)
		c.hits++
		return item.value, true
	}

	c.misses++
	return nil, false
}

func (c *LRUCache) Set(key string, value interface{}) {
	c.SetWithTTL(key, value, c.ttl)
}

func (c *LRUCache) SetWithTTL(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		c.evictList.MoveToFront(elem)
		item := elem.Value.(*cacheItem)
		item.value = value
		item.expiresAt = time.Now().Add(ttl)
		return
	}

	if c.evictList.Len() >= c.capacity {
		c.evictOldest()
	}

	item := &cacheItem{
		key:       key,
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
	elem := c.evictList.PushFront(item)
	c.items[key] = elem
}

func (c *LRUCache) Delete(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		c.removeElement(elem)
		return true
	}
	return false
}

func (c *LRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*list.Element)
	c.evictList.Init()
}

func (c *LRUCache) Stats() (hits int64, misses int64, size int) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hits, c.misses, c.evictList.Len()
}

func (c *LRUCache) removeElement(elem *list.Element) {
	c.evictList.Remove(elem)
	item := elem.Value.(*cacheItem)
	delete(c.items, item.key)
}

func (c *LRUCache) evictOldest() {
	elem := c.evictList.Back()
	if elem != nil {
		c.removeElement(elem)
	}
}
