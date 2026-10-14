"""
FlowGraph — Navigate the node/edge graph defined in a flow's definition_json.
"""
from typing import Optional, List, Dict


class FlowGraph:
    def __init__(self, definition: dict):
        self.nodes: Dict[str, dict] = {n["id"]: n for n in definition.get("nodes", [])}
        self.edges: List[dict] = definition.get("edges", [])

    def get_node(self, node_id: str) -> Optional[dict]:
        return self.nodes.get(node_id)

    def get_trigger_node(self) -> Optional[dict]:
        trigger_types = {
            "trigger", "whatsapp_trigger", "telegram_trigger", 
            "webhook_trigger", "gmail_inbox", "schedule"
        }
        for node in self.nodes.values():
            if node.get("type") in trigger_types:
                return node
        return None

    def get_next_nodes(self, node_id: str) -> List[str]:
        """Return IDs of all nodes connected via outgoing edges from node_id."""
        return [
            edge["target"]
            for edge in self.edges
            if edge["source"] == node_id
        ]

    def get_all_nodes_in_order(self) -> List[dict]:
        """BFS traversal starting from trigger."""
        trigger = self.get_trigger_node()
        if not trigger:
            return []

        visited = set()
        queue = [trigger["id"]]
        result = []

        while queue:
            node_id = queue.pop(0)
            if node_id in visited:
                continue
            visited.add(node_id)
            node = self.get_node(node_id)
            if node:
                result.append(node)
                queue.extend(self.get_next_nodes(node_id))

        return result
