from typing import Dict, Any, List, Set, Tuple
from collections import deque
from app.engines.financial_metrics.base_metric import BaseMetric

def build_adjacency_structures(graph: Dict[str, Any]) -> Tuple[List[str], Dict[str, List[str]], Dict[str, List[str]], Dict[Tuple[str, str], float]]:
    nodes = [n["account_id"] for n in graph.get("nodes", [])]
    edges = graph.get("edges", [])
    
    adj_directed = {node: [] for node in nodes}
    adj_undirected = {node: [] for node in nodes}
    edge_weights = {}

    for edge in edges:
        u = edge["from"]
        v = edge["to"]
        amt = float(edge.get("amount", 0.0))
        
        if u in adj_directed:
            adj_directed[u].append(v)
        if u in adj_undirected:
            adj_undirected[u].append(v)
        if v in adj_undirected:
            adj_undirected[v].append(u)
            
        pair = (u, v)
        edge_weights[pair] = edge_weights.get(pair, 0.0) + amt

    return nodes, adj_directed, adj_undirected, edge_weights

def count_connected_components(nodes: List[str], adj_undirected: Dict[str, List[str]], skip_node: str = None) -> int:
    visited = set()
    components = 0
    
    for node in nodes:
        if node == skip_node or node in visited:
            continue
            
        components += 1
        # BFS
        queue = deque([node])
        visited.add(node)
        
        while queue:
            curr = queue.popleft()
            for neighbor in adj_undirected.get(curr, []):
                if neighbor != skip_node and neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
                    
    return components

class MaximumLayerDepthMetric(BaseMetric):
    name = "Maximum Layer Depth"
    category = "Graph Metrics"
    description = "Calculates the maximum directed hop depth in the money flow network."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, adj_directed, _, _ = build_adjacency_structures(graph)
        if not nodes:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0,
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        # Run BFS from each node to find max depth
        max_depth = 0
        for start in nodes:
            visited = {start: 0}
            queue = deque([start])
            while queue:
                curr = queue.popleft()
                curr_dist = visited[curr]
                max_depth = max(max_depth, curr_dist)
                for neighbor in adj_directed.get(curr, []):
                    if neighbor not in visited:
                        visited[neighbor] = curr_dist + 1
                        queue.append(neighbor)

        severity = "High" if max_depth >= 3 else ("Medium" if max_depth >= 2 else "Low")
        desc = f"Maximum money routing depth is {max_depth} layers."

        return {
            "name": self.name,
            "category": self.category,
            "value": max_depth,
            "severity": severity,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class LongestMoneyPathMetric(BaseMetric):
    name = "Longest Money Path"
    category = "Graph Metrics"
    description = "Identifies the longest sequence of directed transfers in the network."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, adj_directed, _, _ = build_adjacency_structures(graph)
        if not nodes:
            return {
                "name": self.name,
                "category": self.category,
                "value": [],
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        longest_path = []
        
        # DFS path finding with cycle avoidance
        def find_longest(curr: str, current_path: List[str]):
            nonlocal longest_path
            if len(current_path) > len(longest_path):
                longest_path = list(current_path)
                
            for neighbor in adj_directed.get(curr, []):
                if neighbor not in current_path: # Avoid cycles
                    current_path.append(neighbor)
                    find_longest(neighbor, current_path)
                    current_path.pop()

        for start in nodes:
            find_longest(start, [start])

        path_str = " -> ".join(longest_path)
        severity = "High" if len(longest_path) >= 4 else ("Medium" if len(longest_path) >= 3 else "Low")
        desc = f"Longest flow path has {len(longest_path) - 1} hops: {path_str}." if len(longest_path) > 1 else "No connected multi-hop paths found."

        return {
            "name": self.name,
            "category": self.category,
            "value": longest_path,
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": [],
            "metadata": {
                "path_nodes_count": len(longest_path),
                "path_string": path_str
            }
        }

class LargestTransactionPathMetric(BaseMetric):
    name = "Largest Transaction Path"
    category = "Graph Metrics"
    description = "Identifies the money path with the largest total transaction volume."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, adj_directed, _, edge_weights = build_adjacency_structures(graph)
        if not nodes:
            return {
                "name": self.name,
                "category": self.category,
                "value": {"path": [], "volume": 0.0},
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        max_volume = 0.0
        best_path = []

        def dfs(curr: str, current_path: List[str], current_vol: float):
            nonlocal max_volume, best_path
            if current_vol > max_volume:
                max_volume = current_vol
                best_path = list(current_path)
                
            for neighbor in adj_directed.get(curr, []):
                if neighbor not in current_path:
                    edge_wt = edge_weights.get((curr, neighbor), 0.0)
                    current_path.append(neighbor)
                    dfs(neighbor, current_path, current_vol + edge_wt)
                    current_path.pop()

        for start in nodes:
            dfs(start, [start], 0.0)

        path_str = " -> ".join(best_path)
        severity = "High" if max_volume >= 500000.0 else ("Medium" if max_volume >= 100000.0 else "Low")
        desc = f"Largest money path volume is ₹{max_volume:,.2f} along path: {path_str}." if max_volume > 0 else "No weighted path found."

        return {
            "name": self.name,
            "category": self.category,
            "value": {
                "path": best_path,
                "volume": max_volume
            },
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": [],
            "metadata": {
                "path_nodes": best_path,
                "volume": max_volume
            }
        }

class MostConnectedAccountMetric(BaseMetric):
    name = "Most Connected Account"
    category = "Graph Metrics"
    description = "Identifies the account with the highest number of connection links (degree)."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, _, adj_undirected, _ = build_adjacency_structures(graph)
        if not nodes:
            return {
                "name": self.name,
                "category": self.category,
                "value": None,
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        degrees = {node: len(set(adj_undirected[node])) for node in nodes}
        most_connected = max(degrees, key=degrees.get)
        max_deg = degrees[most_connected]

        severity = "High" if max_deg >= 15 else ("Medium" if max_deg >= 8 else "Low")
        desc = f"Account '{most_connected}' is the most connected node with {max_deg} links."

        return {
            "name": self.name,
            "category": self.category,
            "value": most_connected,
            "severity": severity,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"degrees": degrees, "highest_degree": max_deg}
        }

class HighestDegreeMetric(BaseMetric):
    name = "Highest Degree"
    category = "Graph Metrics"
    description = "The maximum number of connections of any single node."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, _, adj_undirected, _ = build_adjacency_structures(graph)
        if not nodes:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0,
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        degrees = [len(set(adj_undirected[node])) for node in nodes]
        max_deg = max(degrees) if degrees else 0
        severity = "High" if max_deg >= 15 else ("Medium" if max_deg >= 8 else "Low")

        return {
            "name": self.name,
            "category": self.category,
            "value": max_deg,
            "severity": severity,
            "description": f"The highest node degree in the graph is {max_deg}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class HighestBetweennessMetric(BaseMetric):
    name = "Highest Betweenness"
    category = "Graph Metrics"
    description = "Identifies the node that acts as the largest hub/bridge for shortest paths."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, _, adj_undirected, _ = build_adjacency_structures(graph)
        if not nodes or len(nodes) < 3:
            return {
                "name": self.name,
                "category": self.category,
                "value": None,
                "severity": "Low",
                "description": "Insufficient nodes to compute betweenness.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        # Brandes' algorithm for betweenness centrality on undirected graph
        betweenness = {node: 0.0 for node in nodes}
        
        for s in nodes:
            S = []
            P = {w: [] for w in nodes}
            sigma = {w: 0 for w in nodes}
            sigma[s] = 1
            d = {w: -1 for w in nodes}
            d[s] = 0
            
            queue = deque([s])
            while queue:
                v = queue.popleft()
                S.append(v)
                for w in adj_undirected[v]:
                    # Path discovery
                    if d[w] < 0:
                        d[w] = d[v] + 1
                        queue.append(w)
                    # Path counting
                    if d[w] == d[v] + 1:
                        sigma[w] += sigma[v]
                        P[w].append(v)
                        
            delta = {w: 0.0 for w in nodes}
            while S:
                w = S.pop()
                for v in P[w]:
                    delta[v] += (sigma[v] / sigma[w]) * (1.0 + delta[w])
                if w != s:
                    betweenness[w] += delta[w]

        # Divide by 2 because undirected paths are counted twice
        for node in betweenness:
            betweenness[node] /= 2.0

        highest = max(betweenness, key=betweenness.get)
        max_bt = betweenness[highest]

        severity = "High" if max_bt >= 10.0 else ("Medium" if max_bt >= 4.0 else "Low")
        desc = f"Node '{highest}' has the highest betweenness centrality of {max_bt:.2f}."

        return {
            "name": self.name,
            "category": self.category,
            "value": highest,
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": [],
            "metadata": {"betweenness_scores": betweenness, "max_betweenness": max_bt}
        }

class LargestCycleMetric(BaseMetric):
    name = "Largest Cycle"
    category = "Graph Metrics"
    description = "Detects the presence and size of cycles, which may indicate circular routing of funds."
    severity = "High"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, adj_directed, _, _ = build_adjacency_structures(graph)
        if not nodes:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0,
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        max_cycle_len = 0
        cycle_paths = []

        def dfs_cycle(curr: str, start: str, visited_path: List[str]):
            nonlocal max_cycle_len
            for neighbor in adj_directed.get(curr, []):
                if neighbor == start:
                    cycle_len = len(visited_path)
                    if cycle_len > max_cycle_len:
                        max_cycle_len = cycle_len
                        cycle_paths.append(list(visited_path))
                elif neighbor not in visited_path:
                    visited_path.append(neighbor)
                    dfs_cycle(neighbor, start, visited_path)
                    visited_path.pop()

        for start in nodes:
            dfs_cycle(start, start, [start])

        severity = "High" if max_cycle_len >= 3 else ("Medium" if max_cycle_len > 0 else "Low")
        desc = f"Largest fund routing cycle detected involves {max_cycle_len} accounts." if max_cycle_len > 0 else "No circular routing cycles detected."

        return {
            "name": self.name,
            "category": self.category,
            "value": max_cycle_len,
            "severity": severity,
            "description": desc,
            "confidence": 0.9,
            "related_transactions": [],
            "metadata": {"cycle_length": max_cycle_len, "cycles": cycle_paths}
        }

class GraphDensityMetric(BaseMetric):
    name = "Graph Density"
    category = "Graph Metrics"
    description = "Ratio of actual links to the maximum possible links in the graph."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])
        v = len(nodes)
        e = len(edges)
        
        density = e / (v * (v - 1)) if v > 1 else 0.0
        severity = "Medium" if density > 0.4 and v > 4 else "Low"
        
        return {
            "name": self.name,
            "category": self.category,
            "value": round(density, 4),
            "severity": severity,
            "description": f"Graph density is {density:.4f} ({e} edges, {v} nodes).",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class AverageDegreeMetric(BaseMetric):
    name = "Average Degree"
    category = "Graph Metrics"
    description = "The average number of links per node."
    severity = "Low"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, _, adj_undirected, _ = build_adjacency_structures(graph)
        v = len(nodes)
        if v == 0:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "Empty graph.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        total_deg = sum(len(set(adj_undirected[node])) for node in nodes)
        avg_deg = total_deg / v

        return {
            "name": self.name,
            "category": self.category,
            "value": round(avg_deg, 2),
            "severity": "Low",
            "description": f"Average degree of nodes in the graph is {avg_deg:.2f}.",
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {}
        }

class CriticalBridgeNodeMetric(BaseMetric):
    name = "Critical Bridge Node"
    category = "Graph Metrics"
    description = "Identifies accounts whose removal splits the connection network, disrupting money flows."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        nodes, _, adj_undirected, _ = build_adjacency_structures(graph)
        if len(nodes) < 3:
            return {
                "name": self.name,
                "category": self.category,
                "value": None,
                "severity": "Low",
                "description": "Insufficient nodes to have a bridge.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        base_components = count_connected_components(nodes, adj_undirected)
        bridge_nodes = []

        for node in nodes:
            # Skip primary owner node as it's the root source
            # Usually bridge node search targets intermediating counterparties
            components_without_node = count_connected_components(nodes, adj_undirected, skip_node=node)
            
            # Since removing a node removes its edges, check if remaining nodes split into more components
            # If so, node is a cut vertex (articulation point)
            if components_without_node > base_components:
                bridge_nodes.append(node)

        severity = "High" if len(bridge_nodes) > 0 else "Low"
        desc = f"Critical bridge nodes identified: {', '.join(bridge_nodes)}." if bridge_nodes else "No critical bridge nodes identified."

        return {
            "name": self.name,
            "category": self.category,
            "value": bridge_nodes[0] if bridge_nodes else None,
            "severity": severity,
            "description": desc,
            "confidence": 0.95,
            "related_transactions": [],
            "metadata": {"bridge_nodes": bridge_nodes}
        }

class MoneyConcentrationPercentMetric(BaseMetric):
    name = "Money Concentration %"
    category = "Graph Metrics"
    description = "Percentage of total transaction volume concentrated in the top 3 counterparties."
    severity = "Medium"

    def compute(self, transactions: List[Dict[str, Any]], entities: Dict[str, Any], graph: Dict[str, Any]) -> Dict[str, Any]:
        edges = graph.get("edges", [])
        if not edges:
            return {
                "name": self.name,
                "category": self.category,
                "value": 0.0,
                "severity": "Low",
                "description": "No transactions.",
                "confidence": 1.0,
                "related_transactions": [],
                "metadata": {}
            }

        # Calculate volume per counterparty (sum of edge amounts)
        counterparty_volume = {}
        total_vol = 0.0
        
        # Identify the primary owner (the most common node in inflows/outflows)
        # We look at edge destinations/sources that are counterparties
        for edge in edges:
            u = edge["from"]
            v = edge["to"]
            amt = float(edge.get("amount", 0.0))
            total_vol += amt
            
            # Record amount for both endpoints
            counterparty_volume[u] = counterparty_volume.get(u, 0.0) + amt
            counterparty_volume[v] = counterparty_volume.get(v, 0.0) + amt

        # Find the primary node (highest volume node)
        primary_node = max(counterparty_volume, key=counterparty_volume.get) if counterparty_volume else None
        
        # Remove the primary node so we only count counterparties
        if primary_node in counterparty_volume:
            del counterparty_volume[primary_node]

        top_three_vols = sorted(counterparty_volume.values(), reverse=True)[:3]
        top_three_total = sum(top_three_vols)
        
        # Calculate percent. Each edge involves two nodes (primary and a counterparty).
        # Total sum of edges equals total_vol.
        pct = (top_three_total / total_vol) * 100 if total_vol > 0 else 0.0
        pct = min(100.0, pct)

        severity = "High" if pct >= 75.0 else ("Medium" if pct >= 40.0 else "Low")
        desc = f"Top 3 counterparties concentrate {pct:.1f}% of total money flow."

        return {
            "name": self.name,
            "category": self.category,
            "value": round(pct, 2),
            "severity": severity,
            "description": desc,
            "confidence": 1.0,
            "related_transactions": [],
            "metadata": {"top_three_volumes": top_three_vols, "total_graph_volume": total_vol}
        }
